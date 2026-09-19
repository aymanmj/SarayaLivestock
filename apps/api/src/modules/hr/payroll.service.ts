import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { GeneratePayrollPeriodDto, ProcessPayrollPaymentDto } from './dto/payroll.dto';
import { AuditActor, appendDomainAudit } from '../../common/audit/domain-audit';
import { PayrollStatus, EmployeeStatus, JournalEntryType, FiscalStatus, Prisma } from '@prisma/client';
import { Money } from '../../common/utils/money.util';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async generatePayroll(farmId: string, dto: GeneratePayrollPeriodDto, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      // 1. Validate Fiscal Period
      const entryDate = new Date(dto.endDate);
      const activePeriod = await tx.fiscalPeriod.findFirst({
        where: {
          fiscalYear: { farmId },
          status: FiscalStatus.OPEN,
          startDate: { lte: entryDate },
          endDate: { gte: entryDate },
        },
      });

      if (!activePeriod) {
        throw new BadRequestException('لا توجد فترة مالية مفتوحة تغطي تاريخ نهاية هذه الرواتب');
      }

      // 2. Fetch Active Employees
      const employees = await tx.employee.findMany({
        where: { farmId, status: EmployeeStatus.ACTIVE },
        include: {
          advances: {
            where: { isSettled: false },
          },
        },
      });

      if (employees.length === 0) {
        throw new BadRequestException('لا يوجد موظفين نشطين لإصدار رواتب لهم');
      }

      // 3. Create Payroll Period
      const payrollPeriod = await tx.payrollPeriod.create({
        data: {
          farmId,
          fiscalPeriodId: activePeriod.id,
          monthName: dto.monthName,
          startDate: new Date(dto.startDate),
          endDate: entryDate,
          status: PayrollStatus.DRAFT,
        },
      });

      let totalSalaries = 0;
      let totalAdvancesSettled = 0;
      let totalNetPayable = 0;

      // 4. Calculate Slips
      for (const emp of employees) {
        const baseSalary = Money.fromPrisma(emp.baseSalary as any);
        
        // Sum all un-settled advances (read current settledAmount from DB)
        const advancesToSettle = emp.advances.reduce((sum, adv) => Money.add(sum, Money.sub(adv.amount as any, adv.settledAmount as any)), 0);
        
        let settledAmount = 0;
        let netSalary = baseSalary;

        if (advancesToSettle > 0) {
          // F1 fix: If advances > salary, we only deduct up to salary. The rest remains.
          settledAmount = Math.min(baseSalary, advancesToSettle);
          netSalary = Money.sub(baseSalary, settledAmount);

          // F6 fix: Only create AdvanceSettlement records, DO NOT mark isSettled yet
          let remainingToSettle = settledAmount;
          for (const adv of emp.advances) {
            if (remainingToSettle <= 0) break;
            
            const advanceBalance = Money.sub(adv.amount as any, adv.settledAmount as any);
            if (advanceBalance <= 0) continue;

            const amountFromThisAdvance = Math.min(advanceBalance, remainingToSettle);
            
            await tx.advanceSettlement.create({
              data: {
                advanceId: adv.id,
                periodId: payrollPeriod.id,
                amount: Money.toDb(amountFromThisAdvance),
              }
            });

            remainingToSettle = Money.sub(remainingToSettle, amountFromThisAdvance);
          }
        }

        await tx.payrollSlip.create({
          data: {
            periodId: payrollPeriod.id,
            employeeId: emp.id,
            baseSalary: Money.toDb(baseSalary),
            advancesSettled: Money.toDb(settledAmount),
            netSalary: Money.toDb(netSalary),
          },
        });

        totalSalaries = Money.add(totalSalaries, baseSalary);
        totalAdvancesSettled = Money.add(totalAdvancesSettled, settledAmount);
        totalNetPayable = Money.add(totalNetPayable, netSalary);
      }

      // S-R4 fix: Audit trail for draft generation
      await appendDomainAudit(tx, actor, {
        action: 'hr.payroll.draft-generated',
        entityType: 'payrollPeriod',
        entityId: payrollPeriod.id,
        farmId,
        metadata: {
          monthName: dto.monthName,
          employeeCount: employees.length,
          totalSalaries,
          totalAdvancesSettled,
          totalNetPayable,
        },
      });

      return payrollPeriod;
    });
  }

  async approvePayroll(farmId: string, periodId: string, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      // F-R1 fix: Atomic state transition — only one request succeeds
      const transition = await tx.payrollPeriod.updateMany({
        where: { id: periodId, farmId, status: PayrollStatus.DRAFT },
        data: { status: PayrollStatus.APPROVED },
      });
      if (transition.count === 0) {
        throw new BadRequestException('يمكن اعتماد مسودة الرواتب فقط، أو تم اعتمادها مسبقاً');
      }

      const period = await tx.payrollPeriod.findFirst({
        where: { id: periodId, farmId },
        include: { 
          slips: true, 
          fiscalPeriod: true,
          advanceSettlements: true,
        },
      });

      if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');

      // F-R2 fix: Re-calculate settlements at approval time using fresh, locked advance data
      // Lock all referenced advances with SELECT FOR UPDATE to prevent concurrent over-settlement
      const advanceIds = [...new Set(period.advanceSettlements.map(s => s.advanceId))];
      let lockedAdvances: Array<{ id: string; amount: any; settledAmount: any }> = [];
      if (advanceIds.length > 0) {
        lockedAdvances = await tx.$queryRawUnsafe<Array<{ id: string; amount: any; settledAmount: any }>>(
          `SELECT "id", "amount", "settledAmount" FROM "hr_employee_advances" WHERE "id" IN (${advanceIds.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
          ...advanceIds,
        );
      }

      const advanceLookup = new Map(lockedAdvances.map(a => [a.id, a]));

      // Recalculate each settlement against current (locked) advance state
      let actualTotalAdvancesSettled = 0;
      // B1 fix: Track settled amount per employee for ALL employees with slips in this period
      const employeeSettlements = new Map<string, number>();
      for (const slip of period.slips) {
        employeeSettlements.set(slip.employeeId, 0);
      }

      for (const settlement of period.advanceSettlements) {
        const freshAdvance = advanceLookup.get(settlement.advanceId);
        if (!freshAdvance) {
          // Advance was deleted; remove this settlement
          await tx.advanceSettlement.delete({ where: { id: settlement.id } });
          continue;
        }

        const currentBalance = Money.sub(
          Money.fromPrisma(freshAdvance.amount),
          Money.fromPrisma(freshAdvance.settledAmount),
        );

        const originalSettlementAmount = Money.fromPrisma(settlement.amount as any);

        if (currentBalance <= 0) {
          // F-R2 & B1 fix: Advance already fully settled by another payroll — remove this settlement
          // Note: employeeSettlements remains 0 for this employee unless another advance exists
          await tx.advanceSettlement.delete({ where: { id: settlement.id } });
          continue;
        }

        // F-R2: Cap settlement at remaining balance
        const adjustedAmount = Math.min(originalSettlementAmount, currentBalance);

        if (adjustedAmount !== originalSettlementAmount) {
          await tx.advanceSettlement.update({
            where: { id: settlement.id },
            data: { amount: Money.toDb(adjustedAmount) },
          });
        }

        // Update the advance's settledAmount
        const newSettledAmount = Money.add(Money.fromPrisma(freshAdvance.settledAmount), adjustedAmount);
        const isFullySettled = newSettledAmount >= Money.fromPrisma(freshAdvance.amount);

        await tx.employeeAdvance.update({
          where: { id: freshAdvance.id },
          data: {
            settledAmount: Money.toDb(newSettledAmount),
            isSettled: isFullySettled,
            settledPeriodId: isFullySettled ? periodId : undefined,
          }
        });

        actualTotalAdvancesSettled = Money.add(actualTotalAdvancesSettled, adjustedAmount);

        // Track per-employee adjustment to recalculate slip
        const employeeAdvance = await tx.employeeAdvance.findUnique({
          where: { id: freshAdvance.id },
          select: { employeeId: true },
        });
        if (employeeAdvance) {
          const current = employeeSettlements.get(employeeAdvance.employeeId) ?? 0;
          employeeSettlements.set(employeeAdvance.employeeId, Money.add(current, adjustedAmount));
        }
      }

      // B1 fix: Update every slip in this period to reflect its true surviving settled advance amount
      for (const slip of period.slips) {
        const settledAmount = employeeSettlements.get(slip.employeeId) ?? 0;
        const currentSlipSettled = Money.fromPrisma(slip.advancesSettled as any);
        if (settledAmount !== currentSlipSettled) {
          const newNetSalary = Money.sub(Money.fromPrisma(slip.baseSalary as any), settledAmount);
          await tx.payrollSlip.update({
            where: { id: slip.id },
            data: {
              advancesSettled: Money.toDb(settledAmount),
              netSalary: Money.toDb(newNetSalary),
            },
          });
        }
      }

      // Re-read updated slips for accurate totals
      const updatedSlips = await tx.payrollSlip.findMany({ where: { periodId } });
      const totalSalaries = updatedSlips.reduce((sum, slip) => Money.add(sum, slip.baseSalary as any), 0);
      const totalAdvancesSettled = updatedSlips.reduce((sum, slip) => Money.add(sum, slip.advancesSettled as any), 0);
      const totalNetPayable = updatedSlips.reduce((sum, slip) => Money.add(sum, slip.netSalary as any), 0);

      // Verify integrity: sum of slip settlements must match actualTotalAdvancesSettled
      if (totalAdvancesSettled !== actualTotalAdvancesSettled) {
        throw new Error(`خلل في تطابق تسويات السلف: إجمالي القسائم (${totalAdvancesSettled}) لا يطابق التسويات المحسوبة (${actualTotalAdvancesSettled})`);
      }

      // Accounting
      const expAccount = await tx.account.findFirst({ where: { farmId, code: '5103' } });
      const liabAccount = await tx.account.findFirst({ where: { farmId, code: '2102' } });
      let advAccount = await tx.account.findFirst({ where: { farmId, code: '1106' } });
      
      if (!advAccount) {
          advAccount = await tx.account.create({
            data: { farmId, code: '1106', name: 'سلف الموظفين والعمالة', category: 'ASSET', isActive: true, isSystemLocked: true }
          });
      }

      if (!expAccount || !liabAccount) throw new Error('System accounts missing');

      const lines = [
        { accountId: expAccount.id, debit: totalSalaries, credit: 0 },
      ];

      if (totalAdvancesSettled > 0) {
        lines.push({ accountId: advAccount.id, debit: 0, credit: totalAdvancesSettled });
      }

      if (totalNetPayable > 0) {
        lines.push({ accountId: liabAccount.id, debit: 0, credit: totalNetPayable });
      }

      const journalEntry = await this.accountingService.createJournalEntry({
        fiscalYearId: period.fiscalPeriod.fiscalYearId,
        fiscalPeriodId: period.fiscalPeriodId,
        entryDate: new Date(period.endDate).toISOString(),
        type: JournalEntryType.MANUAL,
        description: `إثبات استحقاق رواتب شهر ${period.monthName}`,
        referenceId: period.id,
        lines,
      }, farmId, actor, undefined, tx);

      return tx.payrollPeriod.update({
        where: { id: period.id },
        data: { journalEntryId: journalEntry.id },
      });
    });
  }

  async deleteDraft(farmId: string, periodId: string, actor?: AuditActor) {
    return this.prisma.$transaction(async tx => {
      // Find period for verification and metadata
      const period = await tx.payrollPeriod.findFirst({
        where: { id: periodId, farmId },
      });

      if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');
      if (period.status !== PayrollStatus.DRAFT) {
        throw new BadRequestException('يمكن حذف مسودات الرواتب فقط');
      }

      // B2 fix: Atomic conditional deletion — only delete if still in DRAFT status.
      // If approvePayroll committed concurrently between read and delete, deleted.count will be 0.
      const deleted = await tx.payrollPeriod.deleteMany({
        where: { id: periodId, farmId, status: PayrollStatus.DRAFT },
      });

      if (deleted.count === 0) {
        throw new BadRequestException('يمكن حذف مسودات الرواتب فقط أو تم اعتمادها مسبقاً');
      }

      // Explicitly delete advance settlements for this period
      await tx.advanceSettlement.deleteMany({
        where: { periodId },
      });

      // S-R4 fix: Audit trail for draft deletion inside the transaction
      const effectiveActor: AuditActor = actor ?? { id: 'system', orgId: 'system', farmId };
      await appendDomainAudit(tx, effectiveActor, {
        action: 'hr.payroll.draft-deleted',
        entityType: 'payrollPeriod',
        entityId: periodId,
        farmId,
        metadata: { monthName: period.monthName },
      });

      return period;
    });
  }

  async payPayroll(farmId: string, periodId: string, dto: ProcessPayrollPaymentDto, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      // F-R1 fix: Atomic state transition — only one concurrent pay request succeeds
      const transition = await tx.payrollPeriod.updateMany({
        where: { id: periodId, farmId, status: PayrollStatus.APPROVED },
        data: { status: PayrollStatus.PAID },
      });
      if (transition.count === 0) {
        throw new BadRequestException('الرواتب غير معتمدة أو تم صرفها مسبقاً');
      }

      const period = await tx.payrollPeriod.findFirst({
        where: { id: periodId, farmId },
        include: { slips: true },
      });

      if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');

      const totalPayable = period.slips.reduce((sum, slip) => Money.add(sum, slip.netSalary as any), 0);

      // A2 fix: Record domain audit event for payroll disbursement inside transaction
      // even if totalPayable === 0 (zero-net payroll)
      const effectiveActor: AuditActor = actor ?? { id: 'system', orgId: 'system', farmId };
      await appendDomainAudit(tx, effectiveActor, {
        action: 'hr.payroll.paid',
        entityType: 'payrollPeriod',
        entityId: period.id,
        farmId,
        metadata: {
          monthName: period.monthName,
          totalPayable,
          zeroNet: totalPayable === 0,
        },
      });

      // F-R3 fix: Zero net payroll — no cash flow, already marked as PAID
      if (totalPayable === 0) {
        return period;
      }

      const liabAccount = await tx.account.findFirst({ where: { farmId, code: '2102' } });
      if (!liabAccount) throw new Error('System accounts missing');

      await this.accountingService.createJournalEntry({
        entryDate: new Date().toISOString(),
        type: JournalEntryType.MANUAL,
        description: `صرف رواتب شهر ${period.monthName}`,
        referenceId: period.id,
        lines: [
          { accountId: liabAccount.id, debit: totalPayable, credit: 0 },
          { accountId: dto.paymentAccountId, debit: 0, credit: totalPayable },
        ],
      }, farmId, actor, undefined, tx);

      return period;
    });
  }

  async findAllPeriods(farmId: string) {
    const periods = await this.prisma.payrollPeriod.findMany({
      where: { farmId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { slips: true } },
        slips: {
          select: {
            baseSalary: true,
            bonuses: true,
            deductions: true,
            advancesSettled: true,
            netSalary: true,
          },
        },
      },
    });

    return periods.map(p => {
      const totalBaseSalary = p.slips.reduce((sum, s) => Money.add(sum, s.baseSalary as any), 0);
      const totalBonuses = p.slips.reduce((sum, s) => Money.add(sum, s.bonuses as any), 0);
      const totalDeductions = p.slips.reduce((sum, s) => Money.add(sum, s.deductions as any), 0);
      const totalAdvancesSettled = p.slips.reduce((sum, s) => Money.add(sum, s.advancesSettled as any), 0);
      const totalNetSalary = p.slips.reduce((sum, s) => Money.add(sum, s.netSalary as any), 0);

      const { slips, ...rest } = p;
      return {
        ...rest,
        totalBaseSalary,
        totalBonuses,
        totalDeductions,
        totalAdvancesSettled,
        totalNetSalary,
      };
    });
  }

  async findSlips(farmId: string, periodId: string) {
    return this.prisma.payrollSlip.findMany({
      where: { periodId, period: { farmId } },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            phone: true,
            bankAccount: true,
            baseSalary: true,
            hireDate: true,
            status: true,
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }
}
