import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calendarDate } from '../utils/calendar-date';

export async function resolveOpenFiscalPeriod(tx: Prisma.TransactionClient, farmId: string, date: Date) {
  const day = calendarDate(date);
  const years = await tx.fiscalYear.findMany({
    where: { farmId, status: 'OPEN', startDate: { lte: day }, endDate: { gte: day } },
    include: { periods: { where: { status: 'OPEN', startDate: { lte: day }, endDate: { gte: day } } } },
  });
  if (years.length !== 1 || years[0].periods.length !== 1) {
    throw new BadRequestException('يجب أن يوافق تاريخ العملية سنة مالية واحدة وفترة واحدة مفتوحتين');
  }
  return { fiscalYear: years[0], fiscalPeriod: years[0].periods[0] };
}
