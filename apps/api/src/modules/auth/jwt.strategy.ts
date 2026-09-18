import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { VaultService } from '../../common/security/vault.service';
import { SessionRevocationReason } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
    @Optional() vaultService?: VaultService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if ((!jwtSecret || jwtSecret.length < 32) && !vaultService) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters');
    }

    const strategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(vaultService
        ? {
            secretOrKeyProvider: (_request: unknown, _rawToken: string, done: (error: Error | null, secret?: string) => void) => {
              vaultService.getSecret('JWT_SECRET').then(
                secret => done(null, secret),
                error => done(error instanceof Error ? error : new Error('JWT secret is unavailable')),
              );
            },
          }
        : { secretOrKey: jwtSecret as string }),
    };
    super(strategyOptions);
  }

  async validate(payload: { sub: string; sid: string }) {
    if (!payload.sid) throw new UnauthorizedException('رمز الدخول لا يرتبط بجلسة صالحة');
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException('المستخدم غير مفعل أو غير مصرح له بالدخول');
    }

    // A1 fix: Guard against sessions whose family was invalidated by logout/logoutAll/roleChange/etc.
    if (session.familyId && typeof this.prisma?.userSession?.findFirst === 'function') {
      const familyRevoked = await this.prisma.userSession.findFirst({
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
      });

      if (familyRevoked) {
        if (typeof this.prisma?.userSession?.updateMany === 'function') {
          await this.prisma.userSession.updateMany({
            where: { id: session.id, revokedAt: null },
            data: { revokedAt: new Date(), revocationReason: familyRevoked.revocationReason },
          });
        }
        throw new UnauthorizedException('تم إبطال جلسات المستخدم');
      }
    }

    const user = session.user;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      farmId: user.farmId,
      orgId: user.orgId,
    };
  }
}
