import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from '@prisma/client';
import { appendDomainAudit } from '../../common/audit/domain-audit';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, dto: UpdateFarmDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async tx => {
      // S-R3 fix: All roles including SUPER_ADMIN are scoped to their org
      const where = { id, orgId: user.orgId };

      const farm = await tx.farm.findFirst({ where });
      if (!farm) throw new NotFoundException('المزرعة غير موجودة');

      // FARM_MANAGER can only modify their own assigned farm
      if (user.role === UserRole.FARM_MANAGER && user.farmId !== id) {
        throw new ForbiddenException('غير مصرح بتعديل هذه المزرعة');
      }

      const updated = await tx.farm.update({
        where: { id },
        data: dto,
      });

      // S3 fix: Domain audit inside the transaction
      await appendDomainAudit(tx, { id: user.id, orgId: user.orgId, farmId: id }, {
        action: 'farm.updated',
        entityType: 'farm',
        entityId: id,
        metadata: { fields: Object.keys(dto) },
      });

      return updated;
    });
  }
}
