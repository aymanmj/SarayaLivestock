import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { calendarDate } from '../utils/calendar-date';

export async function animalBookValue(tx: Prisma.TransactionClient, farmId: string, animalId: string, date: Date) {
  const lines = await tx.journalEntryLine.findMany({
    where: { animalId, journalEntry: { farmId, status: 'POSTED' } },
    include: { journalEntry: { select: { entryDate: true } } },
  });
  if (!lines.length) throw new BadRequestException('يلزم ربط القيمة الدفترية للحيوان بقيد أصل معتمد قبل البيع أو النفوق؛ سعر الشراء ليس رصيداً دفترياً');
  if (lines.some(line => line.journalEntry.entryDate > calendarDate(date))) {
    throw new BadRequestException('توجد قيود للحيوان بعد تاريخ الاستبعاد؛ يلزم تسويتها أولاً');
  }
  const balances = new Map<string, Decimal>();
  for (const line of lines) {
    balances.set(line.accountId, (balances.get(line.accountId) ?? new Decimal(0)).plus(line.debit.toString()).minus(line.credit.toString()));
  }
  if ([...balances.values()].some(value => value.isNegative())) throw new BadRequestException('رصيد أصل الحيوان سالب؛ يلزم تسوية دفتر الأصول');
  const assets = [...balances].filter(([, value]) => value.gt(0)).map(([accountId, value]) => ({ accountId, value: value.toNumber() }));
  const total = [...balances.values()].reduce((sum, value) => sum.plus(value), new Decimal(0)).toNumber();
  return { total, assets };
}
