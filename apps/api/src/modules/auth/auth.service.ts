import { Injectable, UnauthorizedException, BadRequestException, OnModuleInit, Logger, ForbiddenException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { SessionRevocationReason, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { RegisterUserDto } from './dto/auth.dto';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { VaultService } from '../../common/security/vault.service';

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Optional() private vaultService?: VaultService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_SEED === 'true') {
      await this.seedDefaultUsers();
    }
  }

  /**
   * إنشاء المستخدمين الافتراضيين لكل دور في المزرعة إذا لم تكن قاعدة البيانات تحتوي على مستخدمين
   */
  async seedDefaultUsers() {
    try {
      const userCount = await this.prisma.user.count();
      if (userCount > 0) return;

      this.logger.log('👥 جاري إنشاء مستخدمي النظام الافتراضيين للمزرعة مع تشفير كلمات المرور...');

      const org = await this.prisma.organization.findFirst();
      const farm = await this.prisma.farm.findFirst();
      const orgId = org ? org.id : (await this.prisma.organization.create({ data: { name: 'السرايا للإنتاج الحيواني' } })).id;
      const farmId = farm ? farm.id : (await this.prisma.farm.create({ data: { name: 'المزرعة الرئيسية', orgId } })).id;

      const demoPassword = process.env.DEMO_USER_PASSWORD;
      if (!demoPassword || demoPassword.length < 12) {
        throw new Error('DEMO_USER_PASSWORD must contain at least 12 characters');
      }
      const passwordHash = await bcrypt.hash(demoPassword, 12);

      const defaultUsers = [
        {
          username: 'admin',
          fullName: 'المهندس / أيمن السرايا (المدير العام)',
          email: 'admin@saraya-livestock.com',
          role: UserRole.SUPER_ADMIN,
        },
        {
          username: 'vet.mahmoud',
          fullName: 'د. محمود البيطري (رئيس الفريق الطبي)',
          email: 'vet@saraya-livestock.com',
          role: UserRole.VETERINARIAN,
        },
        {
          username: 'manager.saad',
          fullName: 'م. سعد الشمري (مدير العمليات الميدانية)',
          email: 'manager@saraya-livestock.com',
          role: UserRole.FARM_MANAGER,
        },
        {
          username: 'milker.ali',
          fullName: 'علي حسن (مشرف المحلب الآلي)',
          email: 'milker@saraya-livestock.com',
          role: UserRole.MILKER,
        },
        {
          username: 'accountant.hassan',
          fullName: 'حسن كمال (محاسب المزرعة والمشتريات)',
          email: 'accountant@saraya-livestock.com',
          role: UserRole.ACCOUNTANT,
        },
      ];

      for (const u of defaultUsers) {
        await this.prisma.user.create({
          data: {
            orgId,
            farmId,
            username: u.username,
            fullName: u.fullName,
            email: u.email,
            password: passwordHash,
            role: u.role,
            isActive: true,
          },
        });
      }

      this.logger.log('✅ تم إنشاء مستخدمي العرض بنجاح');
    } catch (e: any) {
      this.logger.warn(`تعذر زراعة المستخدمين: ${e.message}`);
    }
  }

  async login(username: string, pass: string, context: SessionContext = {}) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('هذا الحساب معطل أو موقوف مؤقتاً، يرجى مراجعة إدارة المزرعة');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');

    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlMs());
    const session = await this.prisma.$transaction(async tx => {
      const created = await tx.userSession.create({
        data: {
          userId: user.id,
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      await appendDomainAudit(tx, user, {
        action: 'identity.session.created',
        entityType: 'userSession',
        entityId: created.id,
        metadata: { expiresAt: expiresAt.toISOString() },
      });
      return created;
    });

    return this.buildAuthenticationResponse(user, session.id, refreshToken);
  }

  async refresh(refreshToken: string, context: SessionContext = {}) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const nextRefreshToken = this.generateRefreshToken();

    const result = await this.prisma.$transaction(async tx => {
      const session = await tx.userSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) return { valid: false as const };

      const actor: AuditActor = session.user;
      const now = new Date();

      // Grace period for concurrent refreshes (30 seconds)
      const isGracePeriod =
        (session.revocationReason === SessionRevocationReason.ROTATED || session.replacedBySessionId) &&
        session.revokedAt &&
        (now.getTime() - session.revokedAt.getTime()) < 30000;

      // Check if the session family was explicitly invalidated
      // (logout, logoutAll, password reset, reuse detection, role change, or user disabled)
      const familyRevoked = typeof tx.userSession.findFirst === 'function'
        ? await tx.userSession.findFirst({
            where: {
              familyId: session.familyId,
              revocationReason: {
                in: [
                  SessionRevocationReason.LOGOUT,
                  SessionRevocationReason.LOGOUT_ALL,
                  SessionRevocationReason.PASSWORD_RESET,
                  SessionRevocationReason.REUSE_DETECTED,
                  SessionRevocationReason.USER_DISABLED,
                  SessionRevocationReason.ROLE_CHANGED,
                ],
              },
            },
          })
        : null;

      if (familyRevoked) {
        return { valid: false as const };
      }

      if ((session.revokedAt || session.replacedBySessionId) && !isGracePeriod) {
        if (session.revocationReason === SessionRevocationReason.ROTATED || session.replacedBySessionId) {
          await tx.userSession.updateMany({
            where: { familyId: session.familyId },
            data: { revokedAt: now, revocationReason: SessionRevocationReason.REUSE_DETECTED },
          });
          await appendDomainAudit(tx, actor, {
            action: 'identity.session.reuse-detected',
            entityType: 'userSession',
            entityId: session.id,
          });
        }
        return { valid: false as const };
      }

      if (session.expiresAt <= now) {
        if (!session.revokedAt) {
          await tx.userSession.update({
            where: { id: session.id },
            data: { revokedAt: now, revocationReason: SessionRevocationReason.EXPIRED },
          });
        }
        return { valid: false as const };
      }

      if (!session.user.isActive) {
        await tx.userSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: now, revocationReason: SessionRevocationReason.USER_DISABLED },
        });
        return { valid: false as const };
      }

      // If we are in the grace period, just issue a new parallel session in the same family
      // instead of revoking the family.
      const nextSession = await tx.userSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.hashRefreshToken(nextRefreshToken),
          expiresAt: session.expiresAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      if (!isGracePeriod) {
        const rotation = await tx.userSession.updateMany({
          where: { id: session.id, revokedAt: null, replacedBySessionId: null },
          data: {
            revokedAt: now,
            revocationReason: SessionRevocationReason.ROTATED,
            replacedBySessionId: nextSession.id,
            lastUsedAt: now,
          },
        });

        if (rotation.count !== 1) {
          await tx.userSession.updateMany({
            where: { familyId: session.familyId },
            data: { revokedAt: now, revocationReason: SessionRevocationReason.REUSE_DETECTED },
          });
          await appendDomainAudit(tx, actor, {
            action: 'identity.session.reuse-detected',
            entityType: 'userSession',
            entityId: session.id,
          });
          return { valid: false as const };
        }
      }

      await appendDomainAudit(tx, actor, {
        action: 'identity.session.refreshed',
        entityType: 'userSession',
        entityId: nextSession.id,
        metadata: { previousSessionId: session.id, isGracePeriod },
      });

      // A1 fix: Final check after audit event insertion and rotation before committing.
      // Guards against concurrent logout/logoutAll/roleChange/passwordReset that committed during this transaction.
      const finalFamilyRevocation = typeof tx.userSession.findFirst === 'function'
        ? await tx.userSession.findFirst({
            where: {
              familyId: session.familyId,
              revocationReason: {
                in: [
                  SessionRevocationReason.LOGOUT,
                  SessionRevocationReason.LOGOUT_ALL,
                  SessionRevocationReason.PASSWORD_RESET,
                  SessionRevocationReason.REUSE_DETECTED,
                  SessionRevocationReason.USER_DISABLED,
                  SessionRevocationReason.ROLE_CHANGED,
                ],
              },
            },
          })
        : null;

      if (finalFamilyRevocation) {
        await tx.userSession.updateMany({
          where: { id: nextSession.id },
          data: { revokedAt: now, revocationReason: finalFamilyRevocation.revocationReason },
        });
        return { valid: false as const };
      }

      return {
        valid: true as const,
        user: session.user,
        sessionId: nextSession.id,
      };
    });

    if (!result.valid) throw new UnauthorizedException('جلسة التحديث غير صالحة أو تم إبطالها');
    return this.buildAuthenticationResponse(result.user, result.sessionId, nextRefreshToken);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { message: 'تم إنهاء الجلسة بنجاح' };
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.$transaction(async tx => {
      const session = await tx.userSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) return;

      const now = new Date();
      // S1 fix: Also revoke ROTATED sessions to prevent grace-period bypass
      await tx.userSession.updateMany({
        where: {
          familyId: session.familyId,
          OR: [
            { revokedAt: null },
            { revocationReason: SessionRevocationReason.ROTATED },
          ],
        },
        data: { revokedAt: now, revocationReason: SessionRevocationReason.LOGOUT },
      });
      await appendDomainAudit(tx, session.user, {
        action: 'identity.session.logged-out',
        entityType: 'userSession',
        entityId: session.id,
      });
    });
    return { message: 'تم إنهاء الجلسة بنجاح' };
  }

  async logoutAll(actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      // S1 fix: Also revoke ROTATED sessions to prevent grace-period bypass
      const revoked = await tx.userSession.updateMany({
        where: {
          userId: actor.id,
          OR: [
            { revokedAt: null },
            { revocationReason: SessionRevocationReason.ROTATED },
          ],
        },
        data: { revokedAt: new Date(), revocationReason: SessionRevocationReason.LOGOUT_ALL },
      });
      await appendDomainAudit(tx, actor, {
        action: 'identity.session.all-logged-out',
        entityType: 'user',
        entityId: actor.id,
        metadata: { sessionsRevoked: revoked.count },
      });
      return { message: 'تم إنهاء جميع الجلسات بنجاح', sessionsRevoked: revoked.count };
    });
  }

  async register(
    data: RegisterUserDto,
    actor: AuditActor,
  ) {
    const farmId = data.farmId || actor.farmId;
    if (!farmId) {
      throw new BadRequestException('يجب تعيين المستخدم إلى مزرعة');
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { username: data.username } });
      if (existing) throw new BadRequestException('اسم المستخدم مسجل مسبقاً في المنظومة');

      const farm = await tx.farm.findFirst({
        where: { id: farmId, orgId: actor.orgId },
        select: { id: true },
      });
      if (!farm) throw new ForbiddenException('لا يمكن إنشاء مستخدم في مزرعة خارج مؤسستك');

      const user = await tx.user.create({
        data: {
          orgId: actor.orgId,
          farmId: farm.id,
          username: data.username,
          fullName: data.fullName,
          email: data.email,
          password: passwordHash,
          role: data.role || UserRole.WORKER,
          isActive: true,
        },
      });
      await appendDomainAudit(tx, actor, {
        action: 'identity.user.created',
        entityType: 'user',
        entityId: user.id,
        farmId: farm.id,
        metadata: { role: user.role },
      });

      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        farmId: user.farmId,
        createdAt: user.createdAt,
      };
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        farmId: true,
        orgId: true,
        farm: {
          select: {
            id: true,
            name: true,
            location: true,
            managerName: true,
            phone: true,
          }
        },
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('المستخدم غير موجود');

    let farm = user.farm;
    if (!farm && (user as any).orgId && typeof this.prisma?.farm?.findFirst === 'function') {
      farm = await this.prisma.farm.findFirst({
        where: { orgId: (user as any).orgId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          location: true,
          managerName: true,
          phone: true,
        },
      });
    }

    return {
      ...user,
      farmId: user.farmId || farm?.id || null,
      farm: farm || undefined,
      permissions: this.getRolePermissions(user.role),
    };
  }

  getRefreshTokenTtlMs() {
    const configured = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    const days = Number.isInteger(configured) && configured >= 1 && configured <= 90 ? configured : 30;
    return days * 24 * 60 * 60 * 1000;
  }

  private generateRefreshToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildAuthenticationResponse(user: User, sessionId: string, refreshToken: string) {
    const payload = {
      sub: user.id,
      sid: sessionId,
      username: user.username,
      role: user.role,
      farmId: user.farmId,
      orgId: user.orgId,
    };
    const secret = this.vaultService ? await this.vaultService.getSecret('JWT_SECRET') : undefined;
    const accessToken = secret
      ? this.jwtService.sign(payload, { secret })
      : this.jwtService.sign(payload);

    let farm: { id: string; name: string; location: string | null; managerName: string | null; phone: string | null } | null = null;
    try {
      if (user.farmId && typeof this.prisma?.farm?.findFirst === 'function') {
        farm = await this.prisma.farm.findFirst({
          where: { id: user.farmId, orgId: user.orgId },
          select: { id: true, name: true, location: true, managerName: true, phone: true },
        });
      } else if (user.orgId && typeof this.prisma?.farm?.findFirst === 'function') {
        farm = await this.prisma.farm.findFirst({
          where: { orgId: user.orgId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, location: true, managerName: true, phone: true },
        });
      }
    } catch {
      // Ignore if farm lookup fails
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        farmId: user.farmId || farm?.id || null,
        farm: farm
          ? {
              id: farm.id,
              name: farm.name,
              location: farm.location,
              managerName: farm.managerName,
              phone: farm.phone,
            }
          : undefined,
      },
      permissions: this.getRolePermissions(user.role),
    };
  }

  getRolePermissions(role: UserRole): string[] {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return ['*']; // Full enterprise privileges
      case UserRole.FARM_MANAGER:
        return [
          'animals.read', 'animals.write',
          'milking.read', 'milking.write',
          'breeding.read', 'breeding.write',
          'fattening.read', 'fattening.write',
          'health.read', 'health.write',
          'nutrition.read', 'nutrition.write',
          'reports.read', 'reports.export',
          'users.read',
        ];
      case UserRole.VETERINARIAN:
        return [
          'animals.read', 'animals.write',
          'health.read', 'health.write', 'health.quarantine',
          'breeding.read', 'breeding.write',
          'reports.read',
        ];
      case UserRole.MILKER:
        return [
          'animals.read',
          'milking.read', 'milking.write',
        ];
      case UserRole.ACCOUNTANT:
        return [
          'reports.read', 'reports.export', 'financials.read', 'financials.write',
          'nutrition.read', 'nutrition.inventory',
        ];
      case UserRole.WORKER:
      default:
        return [
          'animals.read',
          'fattening.read', 'fattening.write',
          'nutrition.dispense',
        ];
    }
  }
}
