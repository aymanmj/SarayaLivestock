import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { SecurityController } from '../../common/security/security.controller';
import { UsersController } from '../users/users.controller';
import { AccountingController } from '../accounting/accounting.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('Authentication security boundaries', () => {
  it('exposes login publicly but keeps registration restricted to super admins', () => {
    const loginHandler = AuthController.prototype.login;
    const registerHandler = AuthController.prototype.register;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, loginHandler)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, registerHandler)).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, registerHandler)).toEqual([UserRole.SUPER_ADMIN]);
  });

  it('keeps browser refresh tokens out of JSON and places them in an HTTP-only cookie', async () => {
    const authentication = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token-that-must-not-be-in-browser-json',
      user: { id: 'user-a', username: 'admin', fullName: 'Admin', role: UserRole.SUPER_ADMIN },
      permissions: ['*'],
    };
    const auth = {
      login: jest.fn().mockResolvedValue(authentication),
      getRefreshTokenTtlMs: jest.fn().mockReturnValue(2_592_000_000),
    } as any;
    const controller = new AuthController(auth);
    const request = {
      ip: '127.0.0.1',
      get: jest.fn((header: string) => header === 'user-agent' ? 'browser-test' : undefined),
    } as any;
    const response = { cookie: jest.fn() } as any;

    const result = await controller.login({ username: 'admin', password: 'password' }, request, response);

    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'saraya_refresh_token',
      authentication.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/api/v1/auth' }),
    );
  });

  it('does not expose a refresh token when a normal browser spoofs the desktop header', async () => {
    const authentication = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token-that-must-remain-http-only',
      user: { id: 'user-a', username: 'admin', fullName: 'Admin', role: UserRole.SUPER_ADMIN },
      permissions: ['*'],
    };
    const auth = {
      login: jest.fn().mockResolvedValue(authentication),
      getRefreshTokenTtlMs: jest.fn().mockReturnValue(2_592_000_000),
    } as any;
    const controller = new AuthController(auth);
    const request = {
      ip: '127.0.0.1',
      get: jest.fn((header: string) => ({
        origin: 'https://saraya.example',
        'x-saraya-client': 'desktop',
      })[header]),
    } as any;
    const response = { cookie: jest.fn() } as any;

    const result = await controller.login({ username: 'admin', password: 'password' }, request, response);

    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('returns the refresh token only to the explicit opaque-origin Electron channel', async () => {
    const authentication = {
      accessToken: 'access-token',
      refreshToken: 'desktop-refresh-token',
      user: { id: 'user-a', username: 'admin', fullName: 'Admin', role: UserRole.SUPER_ADMIN },
      permissions: ['*'],
    };
    const auth = {
      login: jest.fn().mockResolvedValue(authentication),
      getRefreshTokenTtlMs: jest.fn(),
    } as any;
    const controller = new AuthController(auth);
    const request = {
      ip: '127.0.0.1',
      get: jest.fn((header: string) => ({ origin: 'null', 'x-saraya-client': 'desktop' })[header]),
    } as any;
    const response = { cookie: jest.fn() } as any;

    const result = await controller.login({ username: 'admin', password: 'password' }, request, response);

    expect(result).toHaveProperty('refreshToken', authentication.refreshToken);
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('allows explicitly public handlers through the global JWT guard', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    const context = {
      getHandler: () => function publicHandler() {},
      getClass: () => class PublicController {},
    } as any;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('restricts security, user administration and accounting controllers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SecurityController)).toEqual([UserRole.SUPER_ADMIN]);
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([UserRole.SUPER_ADMIN]);
    expect(Reflect.getMetadata(ROLES_KEY, AccountingController)).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ACCOUNTANT,
    ]);
  });

  it('does not accept the legacy default password when it does not match the hash', async () => {
    const passwordHash = await bcrypt.hash('a-different-secure-password', 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          password: passwordHash,
          isActive: true,
          fullName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          farmId: 'farm-1',
          orgId: 'org-1',
        }),
      },
    };
    const jwt = { sign: jest.fn() };
    const service = new AuthService(prisma as any, jwt as any);

    await expect(service.login('admin', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
