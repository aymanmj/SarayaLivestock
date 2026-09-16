import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { AnimalStatus, LifeStage, Prisma } from '@prisma/client';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class AnimalsService {
  constructor(private prisma: PrismaService) {}

  async create(createAnimalDto: CreateAnimalDto, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      await this.assertRelatedEntitiesBelongToFarm(tx, farmId, createAnimalDto.barnId, createAnimalDto.motherId);
      const existing = await tx.animal.findFirst({
        where: {
          tagNumber: createAnimalDto.tagNumber,
          farmId,
        },
      });

      if (existing) {
        throw new ConflictException(`الحيوان برقم القرط ${createAnimalDto.tagNumber} مسجل مسبقاً في هذه المزرعة`);
      }

      const animal = await tx.animal.create({
        data: {
          farmId,
          barnId: createAnimalDto.barnId,
          tagNumber: createAnimalDto.tagNumber,
          rfidTag: createAnimalDto.rfidTag,
          name: createAnimalDto.name,
          species: createAnimalDto.species,
          breed: createAnimalDto.breed,
          gender: createAnimalDto.gender,
          purpose: createAnimalDto.purpose,
          currentLifeStage: createAnimalDto.currentLifeStage,
          birthDate: createAnimalDto.birthDate ? new Date(createAnimalDto.birthDate) : null,
          entryWeightKg: createAnimalDto.entryWeightKg,
          purchasePrice: createAnimalDto.purchasePrice,
          motherId: createAnimalDto.motherId,
          fatherSemenCode: createAnimalDto.fatherSemenCode,
        },
        include: {
          barn: true,
          mother: true,
        },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'herd.animal.created',
        entityType: 'animal',
        entityId: animal.id,
        farmId,
        metadata: { tagNumber: animal.tagNumber, species: animal.species },
      });
      return animal;
    });
  }

  async findAll(farmId: string, options?: { status?: AnimalStatus; barnId?: string; search?: string }) {
    const where: any = { farmId };

    if (options?.status) where.status = options.status;
    if (options?.barnId) where.barnId = options.barnId;
    if (options?.search) {
      where.OR = [
        { tagNumber: { contains: options.search, mode: 'insensitive' } },
        { rfidTag: { contains: options.search, mode: 'insensitive' } },
        { name: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.animal.findMany({
      where,
      include: {
        barn: true,
        _count: {
          select: {
            milkLogs: true,
            weightLogs: true,
            breedingRecords: true,
            healthTreatments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, farmId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: { id, farmId },
      include: {
        barn: true,
        mother: true,
        children: true,
        milkLogs: { take: 30, orderBy: { logDate: 'desc' } },
        weightLogs: { take: 10, orderBy: { weighDate: 'desc' } },
        breedingRecords: { take: 5, orderBy: { inseminationDate: 'desc' } },
        healthTreatments: { take: 5, orderBy: { treatmentDate: 'desc' } },
      },
    });

    if (!animal) throw new NotFoundException('لم يتم العثور على سجل الحيوان');
    return animal;
  }

  async updateLifeStage(id: string, stage: LifeStage, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    if (stage === LifeStage.DRY) throw new ConflictException('سجّل التجفيف من مهمة الحمل الجارية');
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({ where: { id, farmId } });
      if (!animal) throw new NotFoundException('لم يتم العثور على سجل الحيوان');
      const updated = await tx.animal.update({
        where: { id },
        data: { currentLifeStage: stage },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'herd.animal.life-stage-changed',
        entityType: 'animal',
        entityId: id,
        farmId,
        metadata: { previousStage: animal.currentLifeStage, newStage: stage },
      });
      return updated;
    });
  }

  async updateBarn(id: string, barnId: string, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({ where: { id, farmId } });
      if (!animal) throw new NotFoundException('لم يتم العثور على سجل الحيوان');
      await this.assertRelatedEntitiesBelongToFarm(tx, farmId, barnId);
      const updated = await tx.animal.update({ where: { id }, data: { barnId } });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'herd.animal.barn-changed',
        entityType: 'animal',
        entityId: id,
        farmId,
        metadata: { previousBarnId: animal.barnId, newBarnId: barnId },
      });
      return updated;
    });
  }

  async updateStatus(
    id: string,
    status: AnimalStatus,
    farmId: string,
    notes?: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({ where: { id, farmId } });
      if (!animal) throw new NotFoundException('لم يتم العثور على سجل الحيوان');
      if (status === AnimalStatus.SOLD || status === AnimalStatus.DECEASED || animal.status === AnimalStatus.SOLD || animal.status === AnimalStatus.DECEASED) {
        throw new ConflictException('البيع والنفوق حالات نهائية تُدار من العمليات التجارية والمالية المخصصة');
      }
      const updated = await tx.animal.update({
        where: { id },
        data: { status },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'herd.animal.status-changed',
        entityType: 'animal',
        entityId: id,
        farmId,
        metadata: { previousStatus: animal.status, newStatus: status, notes },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async assertRelatedEntitiesBelongToFarm(
    tx: Prisma.TransactionClient,
    farmId: string,
    barnId?: string,
    motherId?: string,
  ) {
    if (barnId) {
      const barn = await tx.barn.findFirst({ where: { id: barnId, farmId }, select: { id: true } });
      if (!barn) throw new NotFoundException('العنبر غير موجود في مزرعة المستخدم');
    }

    if (motherId) {
      const mother = await tx.animal.findFirst({ where: { id: motherId, farmId }, select: { id: true } });
      if (!mother) throw new NotFoundException('سجل الأم غير موجود في مزرعة المستخدم');
    }
  }
}
