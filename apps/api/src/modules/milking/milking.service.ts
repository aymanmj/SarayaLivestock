import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LogMilkDto } from './dto/log-milk.dto';
import { MilkQualityEngine } from '../../common/utils/milk-quality.util';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class MilkingService {
  constructor(private prisma: PrismaService) {}

  async logMilk(dto: LogMilkDto, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({
        where: {
          farmId,
          OR: [
            { id: dto.animalId },
            { tagNumber: dto.animalId },
            { rfidTag: dto.animalId },
          ],
        },
      });
      if (!animal) throw new NotFoundException('البقرة غير مسجلة (يرجى التحقق من رقم القرط أو الشريحة)');

      const milkingDate = new Date(dto.logDate);
      let isDiscarded = dto.isDiscarded || false;
      let discardReason = dto.discardReason;
      if (animal.withdrawalEndDate && milkingDate <= animal.withdrawalEndDate) {
        isDiscarded = true;
        discardReason = `🚨 حليب مهدر إجبارياً: البقرة تحت فترة تحريم دوائي تنتهي في (${animal.withdrawalEndDate.toISOString().split('T')[0]})`;
      }

      if (tx.healthTreatment?.findMany) {
        const treatments = await tx.healthTreatment.findMany({
          where: {
            animalId: animal.id,
            treatmentDate: { lte: milkingDate },
            milkWithdrawalDays: { gt: 0 },
          },
        });
        for (const t of treatments) {
          const tEnd = new Date(t.treatmentDate);
          tEnd.setDate(tEnd.getDate() + t.milkWithdrawalDays);
          if (milkingDate <= tEnd) {
            isDiscarded = true;
            discardReason = `🚨 حليب مهدر إجبارياً: علاج بيطري (${t.drugName}) تحت فترة تحريم حليب حتى (${tEnd.toISOString().split('T')[0]})`;
            break;
          }
        }
      }

      const sevenDaysAgo = new Date(milkingDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const pastLogs = await tx.milkLog.findMany({
        where: {
          animalId: animal.id,
          logDate: { gte: sevenDaysAgo },
        },
      });

      let hasAnomaly = false;
      let dropPct = 0;
      if (pastLogs.length > 0) {
        const avgPastYield = pastLogs.reduce((acc, log) => acc + Number(log.yieldLiters), 0) / pastLogs.length;
        const anomalyCheck = MilkQualityEngine.detectYieldDropAnomaly(dto.yieldLiters, avgPastYield);
        hasAnomaly = anomalyCheck.hasAnomaly;
        dropPct = anomalyCheck.dropPercentage;
      }

      const milkLog = await tx.milkLog.create({
        data: {
          animalId: animal.id,
          logDate: new Date(dto.logDate),
          shift: dto.shift,
          yieldLiters: dto.yieldLiters,
          fatPct: dto.fatPct,
          proteinPct: dto.proteinPct,
          isDiscarded,
          discardReason,
        },
        include: { animal: true },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'milking.yield.recorded',
        entityType: 'milkLog',
        entityId: milkLog.id,
        farmId,
        metadata: { animalId: animal.id, shift: dto.shift, isDiscarded },
      });

      return {
        milkLog,
        safetyWarning: isDiscarded ? discardReason : null,
        healthAlert: hasAnomaly ? `⚠️ تنبيه بيطري: انخفاض مفاجئ في إدرار البقرة بنسبة ${dropPct}%` : null,
      };
    });
  }

  async getDailyFarmSummary(farmId: string, dateStr?: string) {
    const requestedDate = dateStr || new Date().toISOString().split('T')[0];
    const targetDate = new Date(`${requestedDate}T00:00:00.000Z`);
    if (Number.isNaN(targetDate.getTime())) throw new BadRequestException('صيغة التاريخ غير صالحة');
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const where: any = {
      logDate: { gte: targetDate, lt: nextDate },
      animal: { farmId },
    };

    const logs = await this.prisma.milkLog.findMany({
      where,
      include: {
        animal: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalLiters = logs.reduce((acc, l) => acc + Number(l.yieldLiters), 0);
    const usableLiters = logs.filter(l => !l.isDiscarded).reduce((acc, l) => acc + Number(l.yieldLiters), 0);
    const discardedLiters = logs.filter(l => l.isDiscarded).reduce((acc, l) => acc + Number(l.yieldLiters), 0);

    return {
      date: requestedDate,
      totalLiters: Number(totalLiters.toFixed(1)),
      usableLiters: Number(usableLiters.toFixed(1)),
      discardedLiters: Number(discardedLiters.toFixed(1)),
      cowsMilkedCount: new Set(logs.map(log => log.animalId)).size,
      averagePerCow: logs.length > 0 ? (totalLiters / new Set(logs.map(log => log.animalId)).size).toFixed(2) : '0',
      logs,
    };
  }
}
