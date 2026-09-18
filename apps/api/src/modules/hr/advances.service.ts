import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { RequestAdvanceDto } from './dto/payroll.dto';
import { AuditActor } from '../../common/audit/domain-audit';
import { JournalEntryType } from '@prisma/client';
import { Money } from '../../common/utils/money.util';

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async requestAdvance(farmId: string, employeeId: string, dto: RequestAdvanceDto, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const emp = await tx.employee.findFirst({ where: { id: employeeId, farmId } });
      if (!emp) throw new BadRequestException('الموظف غير موجود');

      let advAccount = await tx.account.findFirst({ where: { farmId, code: '1106' } });
      if (!advAccount) {
         advAccount = await tx.account.create({
           data: { farmId, code: '1106', name: 'سلف الموظفين والعمالة', category: 'ASSET', isActive: true, isSystemLocked: true }
         });
      }

      const advance = await tx.employeeAdvance.create({
        data: {
          employeeId,
          amount: Money.toDb(dto.amount),
          requestDate: new Date(dto.requestDate),
          reason: dto.reason,
        },
      });

      const journalEntry = await this.accountingService.createJournalEntry({
        entryDate: new Date(dto.requestDate).toISOString(),
        type: JournalEntryType.MANUAL,
        description: `صرف سلفة للموظف ${emp.firstName} ${emp.lastName}`,
        referenceId: advance.id,
        lines: [
          { accountId: advAccount.id, debit: dto.amount, credit: 0 },
          { accountId: dto.paymentAccountId, debit: 0, credit: dto.amount },
        ],
      }, farmId, actor, undefined, tx);

      return tx.employeeAdvance.update({
        where: { id: advance.id },
        data: { journalEntryId: journalEntry.id },
      });
    });
  }

  async findAllAdvances(farmId: string) {
    return this.prisma.employeeAdvance.findMany({
      where: { employee: { farmId } },
      include: { employee: true },
      orderBy: { requestDate: 'desc' },
    });
  }
}
