import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InseminateDto } from './dto/inseminate.dto';
import { BreedingEngine, TargetSpecies } from '../../common/utils/breeding.util';
import { PregnancyResult, LifeStage, Gender, Purpose } from '@prisma/client';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class BreedingService {
  constructor(private prisma: PrismaService) {}

  async recordInsemination(dto: InseminateDto, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
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

      const insemDate = new Date(dto.inseminationDate);
      const species = animal.species as unknown as TargetSpecies;
      const expectedCalving = BreedingEngine.calculateExpectedCalvingDate(insemDate, species);
      const expectedDryOff = BreedingEngine.calculateExpectedDryoffDate(insemDate, species);
      const pdCheckDate = BreedingEngine.calculatePdCheckDate(insemDate, species);

      const record = await tx.breedingRecord.create({
        data: {
          animalId: animal.id,
          inseminationDate: insemDate,
          inseminationType: dto.inseminationType,
          semenCode: dto.semenCode,
          inseminatorName: dto.inseminatorName,
          pdCheckDate,
          expectedCalvingDate: expectedCalving,
          expectedDryoffDate: expectedDryOff,
          notes: dto.notes,
        },
        include: { animal: true },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'breeding.insemination.recorded',
        entityType: 'breedingRecord',
        entityId: record.id,
        farmId,
        metadata: { animalId: animal.id, inseminationType: dto.inseminationType },
      });
      return record;
    });
  }

  async recordPdResult(
    recordId: string,
    result: PregnancyResult,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const ownedRecord = await tx.breedingRecord.findFirst({
        where: { id: recordId, animal: { farmId } },
        include: { animal: true },
      });
      if (!ownedRecord) throw new NotFoundException('سجل التلقيح غير موجود');

      const record = await tx.breedingRecord.update({
        where: { id: recordId },
        data: { pdResult: result },
        include: { animal: true },
      });

      if (result === PregnancyResult.PREGNANT && ownedRecord.animal.currentLifeStage === LifeStage.HEIFER) {
        await tx.animal.update({
          where: { id: ownedRecord.animalId },
          data: { currentLifeStage: LifeStage.PREGNANT_HEIFER },
        });
      }

      if (actor) await appendDomainAudit(tx, actor, {
        action: 'breeding.pregnancy-result.recorded',
        entityType: 'breedingRecord',
        entityId: recordId,
        farmId,
        metadata: { animalId: ownedRecord.animalId, result },
      });
      return record;
    });
  }

  async recordCalving(
    recordId: string,
    data: {
      actualCalvingDate: string;
      offspringTagNumber: string;
      offspringGender: Gender;
      offspringWeightKg?: number;
    },
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const record = await tx.breedingRecord.findFirst({
        where: { id: recordId, animal: { farmId } },
        include: { animal: true },
      });
      if (!record) throw new NotFoundException('سجل التلقيح غير موجود');

      const calvingDate = new Date(data.actualCalvingDate);
      if (calvingDate < record.inseminationDate) {
        throw new BadRequestException('تاريخ الولادة لا يمكن أن يسبق تاريخ التلقيح');
      }

      const duplicateTag = await tx.animal.findFirst({
        where: { farmId, tagNumber: data.offspringTagNumber },
        select: { id: true },
      });
      if (duplicateTag) throw new ConflictException('رقم قرط المولود مسجل مسبقاً في مزرعة المستخدم');

      await tx.breedingRecord.update({
        where: { id: recordId },
        data: {
          actualCalvingDate: calvingDate,
          offspringGender: data.offspringGender,
        },
      });

      await tx.animal.update({
        where: { id: record.animalId },
        data: { currentLifeStage: LifeStage.LACTATING },
      });

      const newborn = await tx.animal.create({
        data: {
          farmId,
          barnId: record.animal.barnId,
          tagNumber: data.offspringTagNumber,
          species: record.animal.species,
          breed: record.animal.breed,
          gender: data.offspringGender,
          purpose: data.offspringGender === Gender.FEMALE ? Purpose.DAIRY : Purpose.BEEF,
          currentLifeStage: LifeStage.CALF,
          birthDate: calvingDate,
          entryWeightKg: data.offspringWeightKg,
          motherId: record.animalId,
          fatherSemenCode: record.semenCode,
        },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'breeding.calving.recorded',
        entityType: 'breedingRecord',
        entityId: recordId,
        farmId,
        metadata: { motherId: record.animalId, newbornId: newborn.id },
      });

      return {
        message: 'تم تسجيل الولادة بنجاح وإنشاء ملف المولود الجديد آلياً',
        motherId: record.animalId,
        newborn,
      };
    });
  }

  async getUpcomingTasks(farmId: string) {
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 30); // 30 days window

    const filter: any = { animal: { farmId } };

    const pendingPdChecks = await this.prisma.breedingRecord.findMany({
      where: {
        ...filter,
        pdResult: PregnancyResult.PENDING,
        pdCheckDate: { lte: next7Days },
      },
      include: { animal: true },
      orderBy: { pdCheckDate: 'asc' },
    });

    const pendingDryOffs = await this.prisma.breedingRecord.findMany({
      where: {
        ...filter,
        animal: { ...(filter.animal || {}), currentLifeStage: LifeStage.LACTATING },
        pdResult: PregnancyResult.PREGNANT,
        expectedDryoffDate: { lte: next7Days },
      },
      include: { animal: true },
      orderBy: { expectedDryoffDate: 'asc' },
    });

    const upcomingCalvings = await this.prisma.breedingRecord.findMany({
      where: {
        ...filter,
        pdResult: PregnancyResult.PREGNANT,
        actualCalvingDate: null,
        expectedCalvingDate: { lte: next7Days },
      },
      include: { animal: true },
      orderBy: { expectedCalvingDate: 'asc' },
    });

    return {
      pendingPdChecks,
      pendingDryOffs,
      upcomingCalvings,
    };
  }

  async getAllBreedingRecords(farmId: string) {
    const where: any = { animal: { farmId } };

    return this.prisma.breedingRecord.findMany({
      where,
      include: {
        animal: true,
      },
      orderBy: { inseminationDate: 'desc' },
      take: 100,
    });
  }
}
