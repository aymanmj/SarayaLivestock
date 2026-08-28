import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecordWeightDto } from './dto/record-weight.dto';
import { GrowthEngine } from '../../common/utils/growth.util';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class FatteningService {
  constructor(private prisma: PrismaService) {}

  async recordWeight(dto: RecordWeightDto, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
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
      if (!animal) throw new NotFoundException('الحيوان غير مسجل (يرجى التحقق من رقم القرط)');

      const weighDate = dto.weighDate ? new Date(dto.weighDate) : new Date();
      const lastWeight = await tx.weightLog.findFirst({
        where: { animalId: animal.id, weighDate: { lt: weighDate } },
        orderBy: { weighDate: 'desc' },
      });

      let adg: number | null = null;
      let daysBetween: number | null = null;
      if (lastWeight) {
        const diffTime = Math.abs(weighDate.getTime() - lastWeight.weighDate.getTime());
        daysBetween = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysBetween > 0) {
          adg = GrowthEngine.calculateAdg(dto.weightKg, Number(lastWeight.weightKg), daysBetween);
        }
      }

      const weightLog = await tx.weightLog.create({
        data: {
          animalId: animal.id,
          weighDate,
          weightKg: dto.weightKg,
          dailyGainAdg: adg,
          daysSinceLast: daysBetween,
          notes: dto.notes,
        },
        include: { animal: true },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'herd.weight.recorded',
        entityType: 'weightLog',
        entityId: weightLog.id,
        farmId,
        metadata: { animalId: animal.id },
      });
      return weightLog;
    });
  }

  async getFatteningPerformance(farmId: string) {
    const where: any = {
      purpose: 'BEEF',
      status: 'ACTIVE',
      farmId,
    };

    const animals = await this.prisma.animal.findMany({
      where,
      include: {
        weightLogs: {
          orderBy: { weighDate: 'desc' },
          take: 2,
        },
        barn: true,
      },
    });

    const performance = animals.map(a => {
      const current = a.weightLogs[0];
      return {
        id: a.id,
        tagNumber: a.tagNumber,
        breed: a.breed,
        barn: a.barn?.name ?? null,
        entryWeightKg: a.entryWeightKg == null ? null : Number(a.entryWeightKg),
        currentWeightKg: current ? Number(current.weightKg) : a.entryWeightKg == null ? null : Number(a.entryWeightKg),
        lastWeighDate: current ? current.weighDate.toISOString().split('T')[0] : null,
        adgKgPerDay: current?.dailyGainAdg ? Number(current.dailyGainAdg) : null,
        totalGainKg: current && a.entryWeightKg != null ? Number(current.weightKg) - Number(a.entryWeightKg) : null,
      };
    });

    return performance;
  }
}
