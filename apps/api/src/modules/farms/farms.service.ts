import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from '@prisma/client';
import { appendDomainAudit } from '../../common/audit/domain-audit';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(user: AuthenticatedUser) {
    const farmId = user.farmId;
    const where = farmId 
      ? { id: farmId, orgId: user.orgId }
      : { orgId: user.orgId };

    const farm = await this.prisma.farm.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (!farm) throw new NotFoundException('المزرعة غير موجودة');
    return farm;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    if (id === 'current') return this.getCurrent(user);

    const farm = await this.prisma.farm.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!farm) throw new NotFoundException('المزرعة غير موجودة');
    if (user.role === UserRole.FARM_MANAGER && user.farmId !== id) {
      throw new ForbiddenException('غير مصرح بالوصول إلى هذه المزرعة');
    }
    return farm;
  }

  async update(id: string, dto: UpdateFarmDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async tx => {
      let targetId = id;
      if (targetId === 'current' || !targetId) {
        const currentFarm = await tx.farm.findFirst({
          where: user.farmId ? { id: user.farmId, orgId: user.orgId } : { orgId: user.orgId },
          orderBy: { createdAt: 'asc' },
        });
        if (!currentFarm) throw new NotFoundException('المزرعة غير موجودة');
        targetId = currentFarm.id;
      }

      // S-R3 fix: All roles including SUPER_ADMIN are scoped to their org
      const where = { id: targetId, orgId: user.orgId };

      const farm = await tx.farm.findFirst({ where });
      if (!farm) throw new NotFoundException('المزرعة غير موجودة');

      // FARM_MANAGER can only modify their own assigned farm
      if (user.role === UserRole.FARM_MANAGER && user.farmId !== targetId) {
        throw new ForbiddenException('غير مصرح بتعديل هذه المزرعة');
      }

      const updated = await tx.farm.update({
        where: { id: targetId },
        data: dto,
      });

      // S3 fix: Domain audit inside the transaction
      await appendDomainAudit(tx, { id: user.id, orgId: user.orgId, farmId: targetId }, {
        action: 'farm.updated',
        entityType: 'farm',
        entityId: targetId,
        metadata: { fields: Object.keys(dto) },
      });

      return updated;
    });
  }
}
