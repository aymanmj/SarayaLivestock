import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { GeneratePayrollPeriodDto, ProcessPayrollPaymentDto } from './dto/payroll.dto';
import { AuditActor } from '../../common/audit/domain-audit';
import { PayrollStatus, EmployeeStatus, JournalEntryType, FiscalStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async generatePayroll(farmId: string, dto: GeneratePayrollPeriodDto, actor: AuditActor) {
    // 1. Validate Fiscal Period
    const entryDate = new Date(dto.endDate);
    const activePeriod = await this.prisma.fiscalPeriod.findFirst({
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
    const employees = await this.prisma.employee.findMany({
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
    const payrollPeriod = await this.prisma.payrollPeriod.create({
      data: {
        farmId,
        fiscalPeriodId: activePeriod.id,
        monthName: dto.monthName,
        startDate: new Date(dto.startDate),
        endDate: entryDate,
        status: PayrollStatus.DRAFT, // Will approve and post directly in this step
      },
    });

    let totalSalaries = new Decimal(0);
    let totalAdvancesSettled = new Decimal(0);
    let totalNetPayable = new Decimal(0);

    // 4. Calculate Slips
    for (const emp of employees) {
      const baseSalary = new Decimal(emp.baseSalary);
      
      // Sum all un-settled advances
      const advancesToSettle = emp.advances.reduce((sum, adv) => sum.plus(adv.amount), new Decimal(0));
      
      let settledAmount = new Decimal(0);
      let netSalary = baseSalary;

      if (advancesToSettle.gt(0)) {
        // If advances > salary, we only deduct up to salary. The rest remains.
        settledAmount = Decimal.min(baseSalary, advancesToSettle);
        netSalary = baseSalary.minus(settledAmount);

        await this.prisma.employeeAdvance.updateMany({
          where: { employeeId: emp.id, isSettled: false },
          data: { isSettled: true, settledPeriodId: payrollPeriod.id },
        });
      }

      await this.prisma.payrollSlip.create({
        data: {
          periodId: payrollPeriod.id,
          employeeId: emp.id,
          baseSalary: baseSalary.toNumber(),
          advancesSettled: settledAmount.toNumber(),
          netSalary: netSalary.toNumber(),
        },
      });

      totalSalaries = totalSalaries.plus(baseSalary);
      totalAdvancesSettled = totalAdvancesSettled.plus(settledAmount);
      totalNetPayable = totalNetPayable.plus(netSalary);
    }

    // 5. Do NOT create Journal Entry yet. Leave as DRAFT.
    return payrollPeriod;
  }

  async approvePayroll(farmId: string, periodId: string, actor: AuditActor) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, farmId },
      include: { slips: true, fiscalPeriod: true },
    });

    if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');
    if (period.status !== PayrollStatus.DRAFT) throw new BadRequestException('يمكن اعتماد مسودة الرواتب فقط');

    const totalSalaries = period.slips.reduce((sum, slip) => sum.plus(slip.baseSalary), new Decimal(0));
    const totalAdvancesSettled = period.slips.reduce((sum, slip) => sum.plus(slip.advancesSettled), new Decimal(0));
    const totalNetPayable = period.slips.reduce((sum, slip) => sum.plus(slip.netSalary), new Decimal(0));

    const expAccount = await this.prisma.account.findFirst({ where: { farmId, code: '5103' } });
    const liabAccount = await this.prisma.account.findFirst({ where: { farmId, code: '2102' } });
    let advAccount = await this.prisma.account.findFirst({ where: { farmId, code: '1106' } });
    
    if (!advAccount) {
        advAccount = await this.prisma.account.create({
          data: { farmId, code: '1106', name: 'سلف الموظفين والعمالة', category: 'ASSET', isActive: true, isSystemLocked: true }
        });
    }

    if (!expAccount || !liabAccount) throw new Error('System accounts missing');

    const lines = [
      { accountId: expAccount.id, debit: totalSalaries.toNumber(), credit: 0 },
    ];

    if (totalAdvancesSettled.gt(0)) {
      lines.push({ accountId: advAccount.id, debit: 0, credit: totalAdvancesSettled.toNumber() });
    }

    if (totalNetPayable.gt(0)) {
      lines.push({ accountId: liabAccount.id, debit: 0, credit: totalNetPayable.toNumber() });
    }

    const journalEntry = await this.accountingService.createJournalEntry({
      fiscalYearId: period.fiscalPeriod.fiscalYearId,
      fiscalPeriodId: period.fiscalPeriodId,
      entryDate: new Date(period.endDate).toISOString(),
      type: JournalEntryType.MANUAL,
      description: `إثبات استحقاق رواتب شهر ${period.monthName}`,
      referenceId: period.id,
      lines,
    }, farmId, actor);

    return this.prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { status: PayrollStatus.APPROVED, journalEntryId: journalEntry.id },
    });
  }

  async deleteDraft(farmId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, farmId },
    });

    if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');
    if (period.status !== PayrollStatus.DRAFT) throw new BadRequestException('يمكن حذف مسودات الرواتب فقط');

    // Revert advances
    await this.prisma.employeeAdvance.updateMany({
      where: { settledPeriodId: periodId },
      data: { isSettled: false, settledPeriodId: null },
    });

    // Delete period (slips cascade)
    return this.prisma.payrollPeriod.delete({
      where: { id: periodId },
    });
  }

  async payPayroll(farmId: string, periodId: string, dto: ProcessPayrollPaymentDto, actor: AuditActor) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, farmId },
      include: { slips: true },
    });

    if (!period) throw new NotFoundException('فترة الرواتب غير موجودة');
    if (period.status !== PayrollStatus.APPROVED) throw new BadRequestException('الرواتب غير معتمدة أو تم صرفها مسبقاً');

    const totalPayable = period.slips.reduce((sum, slip) => sum.plus(slip.netSalary), new Decimal(0));

    const liabAccount = await this.prisma.account.findFirst({ where: { farmId, code: '2102' } });
    if (!liabAccount) throw new Error('System accounts missing');

    const paymentEntry = await this.accountingService.createJournalEntry({
      entryDate: new Date().toISOString(),
      type: JournalEntryType.MANUAL,
      description: `صرف رواتب شهر ${period.monthName}`,
      referenceId: period.id,
      lines: [
        { accountId: liabAccount.id, debit: totalPayable.toNumber(), credit: 0 },
        { accountId: dto.paymentAccountId, debit: 0, credit: totalPayable.toNumber() },
      ],
    }, farmId, actor);

    return this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: PayrollStatus.PAID },
    });
  }

  async findAllPeriods(farmId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { farmId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { slips: true } },
      },
    });
  }

  async findSlips(farmId: string, periodId: string) {
    return this.prisma.payrollSlip.findMany({
      where: { periodId, period: { farmId } },
      include: { employee: true },
    });
  }
}
