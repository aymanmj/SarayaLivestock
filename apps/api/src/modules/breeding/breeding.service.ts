import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InseminateDto } from './dto/inseminate.dto';
import { BreedingEngine, TargetSpecies } from '../../common/utils/breeding.util';
import { PregnancyResult, LifeStage, Gender, Purpose, Prisma, CalvingDifficulty } from '@prisma/client';
import { RecordCalvingDto } from './dto/breeding-actions.dto';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class BreedingService {
  constructor(private prisma: PrismaService) {}

  async recordDryOff(recordId: string, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const record = await tx.breedingRecord.findFirst({ where: { id: recordId, animal: { farmId } }, include: { animal: true } });
      if (!record) throw new NotFoundException('سجل الحمل غير موجود');
      const maxAdvanceDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      if (record.actualCalvingDate || record.pdResult !== PregnancyResult.PREGNANT ||
          record.animal.status !== 'ACTIVE' || record.animal.currentLifeStage !== LifeStage.LACTATING ||
          !record.expectedDryoffDate || record.expectedDryoffDate > maxAdvanceDate) {
        throw new ConflictException('التجفيف يتطلب حملاً جارياً مؤكداً وأماً حلوباً وحلول نافذة التجفيف المعتمدة');
      }
      const animal = await tx.animal.update({ where: { id: record.animalId }, data: { currentLifeStage: LifeStage.DRY } });
      if (actor) await appendDomainAudit(tx, actor, { action: 'breeding.dry-off.recorded', entityType: 'breedingRecord', entityId: recordId, farmId, metadata: { animalId: animal.id } });
      return animal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

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

      if (animal.gender === Gender.MALE) {
        throw new BadRequestException('لا يمكن تلقيح حيوان ذكر');
      }
      if (animal.status !== 'ACTIVE') {
        throw new BadRequestException(`لا يمكن تلقيح الحيوان لأن حالته (${animal.status}) غير نشطة`);
      }

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
    data: RecordCalvingDto,
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

      if (record.actualCalvingDate) {
        throw new ConflictException('تم تسجيل ولادة لهذا التلقيح مسبقاً ولا يمكن تكرار تسجيل ولادة لنفس السجل');
      }

      const calvingDate = new Date(data.actualCalvingDate);
      if (calvingDate < record.inseminationDate) {
        throw new BadRequestException('تاريخ الولادة لا يمكن أن يسبق تاريخ التلقيح');
      }

      const isAbortion = data.calvingDifficulty === CalvingDifficulty.ABORTION;
      const diffDays = Math.round((calvingDate.getTime() - new Date(record.inseminationDate).getTime()) / (1000 * 60 * 60 * 24));
      if (!isAbortion && diffDays < 150) {
        throw new BadRequestException(`فترة الحمل غير منطقية بيولوجياً (${diffDays} يوماً). لا يمكن تسجيل ولادة طبيعية أو متعسرة قبل 150 يوماً من التلقيح`);
      }

      // تجهيز قائمة المواليد (مفرد أو توأم)
      const offspringList: Array<{ tagNumber: string; gender: Gender; weightKg?: number }> = isAbortion ? [] : [
        {
          tagNumber: data.offspringTagNumber,
          gender: data.offspringGender,
          weightKg: data.offspringWeightKg,
        },
      ];
      if (!isAbortion && data.twins) {
        for (const twin of data.twins) {
          if (twin.tagNumber) {
            offspringList.push({
              tagNumber: twin.tagNumber,
              gender: twin.gender || data.offspringGender,
              weightKg: twin.weightKg,
            });
          }
        }
      }

      for (const off of offspringList) {
        const duplicateTag = await tx.animal.findFirst({
          where: { farmId, tagNumber: off.tagNumber },
          select: { id: true },
        });
        if (duplicateTag) throw new ConflictException(`رقم قرط المولود (${off.tagNumber}) مسجل مسبقاً في مزرعة المستخدم`);
      }

      await tx.breedingRecord.update({
        where: { id: recordId },
        data: {
          actualCalvingDate: calvingDate,
          offspringGender: data.offspringGender,
          offspringCount: offspringList.length,
          calvingDifficulty: data.calvingDifficulty,
          pdResult: isAbortion ? PregnancyResult.OPEN : record.pdResult,
          notes: data.notes,
        },
      });

      const nextLifeStage = isAbortion
        ? (record.animal.currentLifeStage === LifeStage.PREGNANT_HEIFER ? LifeStage.HEIFER : LifeStage.DRY)
        : LifeStage.LACTATING;

      await tx.animal.update({
        where: { id: record.animalId },
        data: { currentLifeStage: nextLifeStage },
      });

      const createdNewborns = [];
      for (const off of offspringList) {
        const newborn = await tx.animal.create({
          data: {
            farmId,
            barnId: record.animal.barnId,
            tagNumber: off.tagNumber,
            species: record.animal.species,
            breed: record.animal.breed,
            gender: off.gender,
            purpose: off.gender === Gender.FEMALE ? Purpose.DAIRY : Purpose.BEEF,
            currentLifeStage: LifeStage.CALF,
            birthDate: calvingDate,
            entryWeightKg: off.weightKg,
            motherId: record.animalId,
            fatherSemenCode: record.semenCode,
          },
        });
        createdNewborns.push(newborn);
      }

      const newborn = createdNewborns[0] ?? null;
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'breeding.calving.recorded',
        entityType: 'breedingRecord',
        entityId: recordId,
        farmId,
        metadata: { motherId: record.animalId, newbornId: newborn?.id ?? null, newbornIds: createdNewborns.map(n => n.id), count: createdNewborns.length, isAbortion },
      });

      return {
        message: isAbortion ? 'تم تسجيل الإجهاض دون إنشاء مولود حي؛ يلزم تقييم حالة الأم بيطرياً' : createdNewborns.length > 1
          ? `تم تسجيل ولادة توأم (${createdNewborns.length} مواليد) بنجاح وإضافتهم إلى سجل القطيع`
          : 'تم تسجيل الولادة بنجاح وإنشاء ملف المولود الجديد آلياً',
        motherId: record.animalId,
        newborn,
        newborns: createdNewborns,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
        actualCalvingDate: null,
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
