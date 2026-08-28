import { UnauthorizedException } from '@nestjs/common';
import { SessionRevocationReason, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('Refresh session rotation', () => {
  const user = {
    id: 'user-a',
    orgId: 'org-a',
    farmId: 'farm-a',
    username: 'admin',
    email: 'admin@example.test',
    password: 'hash',
    fullName: 'Admin',
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('stores only a SHA-256 refresh-token hash and binds the access token to the session', async () => {
    const password = 'secure-password-2026';
    const tx = {
      userSession: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({
          id: 'session-a', familyId: 'family-a', ...data,
        })),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({
        ...user, password: await bcrypt.hash(password, 4),
      }) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const jwt = { sign: jest.fn().mockReturnValue('access-token') };
    const service = new AuthService(prisma, jwt as any);

    const result = await service.login('admin', password);

    const persistedHash = tx.userSession.create.mock.calls[0][0].data.tokenHash;
    expect(result.refreshToken).toHaveLength(43);
    expect(persistedHash).toHaveLength(64);
    expect(persistedHash).not.toBe(result.refreshToken);
    expect(persistedHash).toBe(createHash('sha256').update(result.refreshToken).digest('hex'));
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 'user-a', sid: 'session-a' }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'identity.session.created', entityId: 'session-a' }),
    }));
  });

  it('uses the current Vault secret for every newly signed access token', async () => {
    const jwt = { sign: jest.fn().mockReturnValue('access-token') };
    const vault = { getSecret: jest.fn().mockResolvedValue('v'.repeat(64)) };
    const service = new AuthService({} as any, jwt as any, vault as any);

    await (service as any).buildAuthenticationResponse(user, 'session-a', 'refresh-token');

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.id, sid: 'session-a' }),
      { secret: 'v'.repeat(64) },
    );
  });

  it('rotates a valid refresh token exactly once', async () => {
    const oldToken = 'old-refresh-token-that-is-long-enough-0001';
    const session = {
      id: 'session-a',
      userId: user.id,
      familyId: 'family-a',
      expiresAt: new Date('2099-01-01'),
      revokedAt: null,
      revocationReason: null,
      replacedBySessionId: null,
      user,
    };
    const tx = {
      userSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'session-b', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const jwt = { sign: jest.fn().mockReturnValue('next-access-token') };
    const service = new AuthService(prisma, jwt as any);

    const result = await service.refresh(oldToken);

    expect(result.refreshToken).not.toBe(oldToken);
    expect(tx.userSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: createHash('sha256').update(oldToken).digest('hex') },
    }));
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session-a', revokedAt: null, replacedBySessionId: null },
      data: expect.objectContaining({
        revocationReason: SessionRevocationReason.ROTATED,
        replacedBySessionId: 'session-b',
      }),
    }));
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sid: 'session-b' }));
  });

  it('revokes the complete token family when a rotated token is reused', async () => {
    const reusedToken = 'reused-refresh-token-that-is-long-enough-01';
    const tx = {
      userSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-a',
          userId: user.id,
          familyId: 'family-a',
          expiresAt: new Date('2099-01-01'),
          revokedAt: new Date('2026-08-27'),
          revocationReason: SessionRevocationReason.ROTATED,
          replacedBySessionId: 'session-b',
          user,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const service = new AuthService(prisma, { sign: jest.fn() } as any);

    await expect(service.refresh(reusedToken)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-a' },
      data: expect.objectContaining({ revocationReason: SessionRevocationReason.REUSE_DETECTED }),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'identity.session.reuse-detected' }),
    }));
  });

  it('accepts an access token only while its server-side session remains active', async () => {
    const prisma = {
      userSession: { findFirst: jest.fn().mockResolvedValue({ user }) },
    } as any;
    const strategy = new JwtStrategy(prisma, { get: () => 'x'.repeat(32) } as any);

    await expect(strategy.validate({ sub: 'user-a', sid: 'session-a' })).resolves.toEqual(
      expect.objectContaining({ id: 'user-a', orgId: 'org-a', role: UserRole.SUPER_ADMIN }),
    );
    expect(prisma.userSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'session-a', userId: 'user-a', revokedAt: null }),
    }));

    prisma.userSession.findFirst.mockResolvedValueOnce(null);
    await expect(strategy.validate({ sub: 'user-a', sid: 'revoked-session' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
