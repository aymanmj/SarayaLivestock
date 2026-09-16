import { BadRequestException } from '@nestjs/common';
import { MilkInventoryPolicy, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

/** Check the sale day and every later balance in the current policy period. */
export async function assertMilkAvailable(
  tx: Prisma.TransactionClient, farmId: string, saleDate: Date, liters: number,
  policy: MilkInventoryPolicy, effectiveDate: Date | null,
) {
  if (effectiveDate && saleDate < effectiveDate) {
    throw new BadRequestException('لا يمكن تسجيل بيع حليب بتاريخ يسبق آخر تغيير لسياسة المخزون');
  }
  const dates = policy === MilkInventoryPolicy.DAILY_RESET ? saleDate : {
    lte: saleDate, ...(effectiveDate ? { gte: effectiveDate } : {}),
  };
  const [produced, sold, tank] = await Promise.all([
    tx.milkLog.aggregate({ where: { animal: { farmId }, isDiscarded: false, logDate: dates }, _sum: { yieldLiters: true } }),
    tx.commercialSale.aggregate({ where: { farmId, saleType: 'MILK', saleDate: dates }, _sum: { liters: true } }),
    tx.bulkTankLog.aggregate({ where: { farmId, logDate: dates }, _sum: { calfFeedingLiters: true, wastedLiters: true } }),
  ]);
  let balance = new Decimal(produced._sum.yieldLiters?.toString() ?? 0)
    .minus(sold._sum.liters?.toString() ?? 0)
    .minus(tank._sum.calfFeedingLiters?.toString() ?? 0)
    .minus(tank._sum.wastedLiters?.toString() ?? 0);
  if (balance.lt(liters)) {
    throw new BadRequestException(`لا يوجد مخزون حليب كافٍ. المتوفر: ${balance.toFixed(3)} لتر، المطلوب: ${liters.toFixed(3)} لتر`);
  }
  if (policy === MilkInventoryPolicy.DAILY_RESET) return;
  const [productionDays, saleDays, tankDays] = await Promise.all([
    tx.milkLog.groupBy({ by: ['logDate'], where: { animal: { farmId }, isDiscarded: false, logDate: { gt: saleDate } }, _sum: { yieldLiters: true } }),
    tx.commercialSale.groupBy({ by: ['saleDate'], where: { farmId, saleType: 'MILK', saleDate: { gt: saleDate } }, _sum: { liters: true } }),
    tx.bulkTankLog.groupBy({ by: ['logDate'], where: { farmId, logDate: { gt: saleDate } }, _sum: { calfFeedingLiters: true, wastedLiters: true } }),
  ]);
  const days = new Map<string, Decimal>();
  const add = (date: Date, delta: Decimal) => {
    const key = date.toISOString().slice(0, 10);
    days.set(key, (days.get(key) ?? new Decimal(0)).plus(delta));
  };
  for (const day of productionDays) add(day.logDate, new Decimal(day._sum.yieldLiters?.toString() ?? 0));
  for (const day of saleDays) add(day.saleDate, new Decimal(day._sum.liters?.toString() ?? 0).negated());
  for (const day of tankDays) add(day.logDate, new Decimal(day._sum.calfFeedingLiters?.toString() ?? 0).plus(day._sum.wastedLiters?.toString() ?? 0).negated());
  for (const [day, delta] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    balance = balance.plus(delta);
    if (balance.lt(liters)) throw new BadRequestException(`البيع سيؤدي إلى عجز في مخزون الحليب بتاريخ ${day}؛ خفّض الكمية أو سوِّ السجلات اللاحقة`);
  }
}
