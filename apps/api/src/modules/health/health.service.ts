import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';
import { Prisma } from '@prisma/client';
import { calendarDate, addCalendarDays } from '../../common/utils/calendar-date';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async recordTreatment(
    dto: CreateTreatmentDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
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

      if (animal.status === 'DECEASED' || animal.status === 'SOLD') {
        throw new BadRequestException(`لا يمكن تسجيل علاج طبي لحيوان حالته (${animal.status})`);
      }

      const treatmentDate = dto.treatmentDate ? new Date(dto.treatmentDate) : new Date();
      const maxWithdrawalDays = Math.max(dto.milkWithdrawalDays || 0, dto.meatWithdrawalDays || 0);
      let withdrawalEndDate: Date | null = null;
      if (maxWithdrawalDays > 0) {
        withdrawalEndDate = addCalendarDays(treatmentDate, maxWithdrawalDays);
      }
      const effectiveAnimalWithdrawalEnd = withdrawalEndDate && animal.withdrawalEndDate
        ? new Date(Math.max(withdrawalEndDate.getTime(), animal.withdrawalEndDate.getTime()))
        : withdrawalEndDate || animal.withdrawalEndDate;

      const createdTreatment = await tx.healthTreatment.create({
        data: {
          animalId: animal.id,
          diagnosis: dto.diagnosis,
          drugName: dto.drugName,
          dosage: dto.dosage,
          treatmentDate,
          milkWithdrawalDays: dto.milkWithdrawalDays || 0,
          meatWithdrawalDays: dto.meatWithdrawalDays || 0,
          withdrawalEndDate,
          vetName: dto.vetName,
          treatmentCost: dto.treatmentCost || 0,
          notes: dto.notes,
        },
      });

      if (effectiveAnimalWithdrawalEnd) {
        await tx.animal.updateMany({
          where: {
            id: animal.id,
            farmId,
            OR: [
              { withdrawalEndDate: null },
              { withdrawalEndDate: { lt: effectiveAnimalWithdrawalEnd } },
            ],
          },
          data: { withdrawalEndDate: effectiveAnimalWithdrawalEnd },
        });
      }

      if (dto.milkWithdrawalDays && dto.milkWithdrawalDays > 0) {
        const milkEnd = addCalendarDays(treatmentDate, dto.milkWithdrawalDays);
        await tx.milkLog.updateMany({
          where: {
            animalId: animal.id,
            logDate: { gte: calendarDate(treatmentDate), lte: milkEnd },
            isDiscarded: false,
          },
          data: {
            isDiscarded: true,
            discardReason: `🚨 حليب مهدر بأثر رجعي: علاج بيطري متأخر (${dto.drugName}) تحت فترة تحريم حتى (${milkEnd.toISOString().split('T')[0]})`,
          },
        });
      }

      if (actor) await appendDomainAudit(tx, actor, {
        action: 'health.treatment.recorded',
        entityType: 'healthTreatment',
        entityId: createdTreatment.id,
        farmId,
        metadata: {
          animalId: animal.id,
          hasWithdrawalLock: Boolean(effectiveAnimalWithdrawalEnd),
        },
      });

      return {
        treatment: createdTreatment,
        warningMessage: withdrawalEndDate
          ? `⚠️ تم تسجيل مدد التحريم: الحليب ${dto.milkWithdrawalDays || 0} يوم، واللحم ${dto.meatWithdrawalDays || 0} يوم من تاريخ العلاج؛ تُقيّم كل مدة بصورة مستقلة.`
          : 'تم تسجيل العلاج بنجاح (لا توجد فترة تحريم).',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getActiveQuarantineList(farmId: string) {
    const now = new Date();
    const where: any = {
      withdrawalEndDate: { gt: now },
      farmId,
    };

    return this.prisma.animal.findMany({
      where,
      include: {
        barn: true,
        healthTreatments: {
          orderBy: { treatmentDate: 'desc' },
          take: 1,
        },
      },
    });
  }
}
