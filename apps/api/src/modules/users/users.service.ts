import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, SessionRevocationReason, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        farmId: true,
        createdAt: true,
        farm: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        farmId: true,
        createdAt: true,
        farm: {
          select: { name: true },
        },
      },
    });

    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async updateUser(id: string, orgId: string, data: { fullName: string; username: string; email?: string }, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const user = await this.assertUserInOrganization(tx, id, orgId);

      const existingUsername = await tx.user.findFirst({
        where: { username: data.username, orgId, id: { not: id } },
      });
      if (existingUsername) throw new BadRequestException('اسم المستخدم مسجل مسبقاً');

      const updated = await tx.user.update({
        where: { id },
        data: {
          fullName: data.fullName,
          username: data.username,
          email: data.email || null,
        },
      });

      await appendDomainAudit(tx, actor, {
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        metadata: { oldUsername: user.username, newUsername: updated.username },
      });

      return {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
      };
    });
  }

  async updateRole(id: string, role: UserRole, orgId: string, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const user = await this.assertUserInOrganization(tx, id, orgId);
      if (user.role === UserRole.SUPER_ADMIN && role !== UserRole.SUPER_ADMIN) {
        await this.assertAnotherActiveSuperAdmin(tx, orgId, id);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { role },
        select: { id: true, username: true, fullName: true, role: true, isActive: true },
      });
      const revoked = await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: SessionRevocationReason.ROLE_CHANGED },
      });
      await appendDomainAudit(tx, actor, {
        action: 'identity.user.role-changed',
        entityType: 'user',
        entityId: id,
        metadata: { previousRole: user.role, newRole: role, sessionsRevoked: revoked.count },
      });
      return updated;
    });
  }

  async toggleStatus(id: string, orgId: string, actor: AuditActor) {
    if (id === actor.id) throw new BadRequestException('لا يمكن تعطيل الحساب المستخدم حالياً');
    return this.prisma.$transaction(async tx => {
      const user = await this.assertUserInOrganization(tx, id, orgId);
      if (user.isActive && user.role === UserRole.SUPER_ADMIN) {
        await this.assertAnotherActiveSuperAdmin(tx, orgId, id);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: { id: true, username: true, fullName: true, role: true, isActive: true },
      });
      const revoked = updated.isActive
        ? { count: 0 }
        : await tx.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date(), revocationReason: SessionRevocationReason.USER_DISABLED },
          });
      await appendDomainAudit(tx, actor, {
        action: 'identity.user.status-changed',
        entityType: 'user',
        entityId: id,
        metadata: {
          previousActive: user.isActive,
          newActive: updated.isActive,
          sessionsRevoked: revoked.count,
        },
      });
      return updated;
    });
  }

  async resetPassword(id: string, newPass: string, orgId: string, actor: AuditActor) {
    const passwordHash = await bcrypt.hash(newPass, 12);
    return this.prisma.$transaction(async tx => {
      await this.assertUserInOrganization(tx, id, orgId);
      await tx.user.update({ where: { id }, data: { password: passwordHash } });
      const revoked = await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: SessionRevocationReason.PASSWORD_RESET },
      });
      await appendDomainAudit(tx, actor, {
        action: 'identity.user.password-reset',
        entityType: 'user',
        entityId: id,
        metadata: { sessionsRevoked: revoked.count },
      });
      return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
    });
  }

  private async assertUserInOrganization(tx: Prisma.TransactionClient, id: string, orgId: string) {
    const user = await tx.user.findFirst({ where: { id, orgId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  private async assertAnotherActiveSuperAdmin(tx: Prisma.TransactionClient, orgId: string, excludedUserId: string) {
    const count = await tx.user.count({
      where: {
        orgId,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        id: { not: excludedUserId },
      },
    });
    if (count === 0) {
      throw new BadRequestException('لا يمكن تعطيل أو خفض صلاحية آخر مدير عام نشط في المؤسسة');
    }
  }
}
