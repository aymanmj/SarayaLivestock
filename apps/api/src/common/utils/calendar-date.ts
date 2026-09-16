import { BadRequestException } from '@nestjs/common';

// Operational date columns use UTC calendar dates, independently of server timezone.
export function calendarDate(value: string | Date): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('صيغة التاريخ غير صالحة');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = calendarDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
