import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBarnDto } from './dto/create-barn.dto';
import { SectorType, Prisma } from '@prisma/client';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class BarnsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(farmId: string) {
    return this.prisma.barn.findMany({
      where: { farmId },
      select: {
        id: true,
        name: true,
        sectorType: true,
        capacity: true,
        _count: { select: { animals: true } },
      },
      orderBy: [{ sectorType: 'asc' }, { name: 'asc' }],
    });
  }

  async createBarn(
    farmId: string,
    dto: CreateBarnDto,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const existing = await tx.barn.findFirst({
        where: { farmId, name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`اسم الحظيرة (${dto.name}) مسجل مسبقاً بالمزرعة`);
      }

      const barn = await tx.barn.create({
        data: {
          farmId,
          name: dto.name,
          sectorType: dto.sectorType ?? SectorType.DAIRY,
          capacity: dto.capacity ?? 50,
        },
      });

      if (actor) {
        await appendDomainAudit(tx, actor, {
          action: 'herd.barn.created',
          entityType: 'barn',
          entityId: barn.id,
          farmId,
          metadata: { name: barn.name, sectorType: barn.sectorType, capacity: barn.capacity },
        });
      }

      return barn;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
