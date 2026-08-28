import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseWriteGuard } from './license-write.guard';

function contextFor(method: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as any;
}

describe('LicenseWriteGuard', () => {
  it('keeps read operations available in read-only mode', async () => {
    const licenseService = { checkLicenseStatus: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    const guard = new LicenseWriteGuard(reflector, licenseService as any);

    await expect(guard.canActivate(contextFor('GET'))).resolves.toBe(true);
    expect(licenseService.checkLicenseStatus).not.toHaveBeenCalled();
  });

  it('blocks writes when the license is invalid or read-only', async () => {
    const licenseService = {
      checkLicenseStatus: jest.fn().mockResolvedValue({
        isValid: false,
        isReadOnly: true,
        message: 'License expired',
      }),
    };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new LicenseWriteGuard(reflector, licenseService as any);

    await expect(guard.canActivate(contextFor('POST'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the explicit activation/bootstrap exception', async () => {
    const licenseService = { checkLicenseStatus: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new LicenseWriteGuard(reflector, licenseService as any);

    await expect(guard.canActivate(contextFor('POST'))).resolves.toBe(true);
    expect(licenseService.checkLicenseStatus).not.toHaveBeenCalled();
  });
});
