import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from './license.service';
import { ALLOW_UNLICENSED_WRITE_KEY } from './license-access.decorator';

@Injectable()
export class LicenseWriteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

    const isAllowedWithoutLicense = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNLICENSED_WRITE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAllowedWithoutLicense) return true;

    const license = await this.licenseService.checkLicenseStatus();
    if (!license.isValid || license.isReadOnly) {
      throw new ForbiddenException({
        code: 'LICENSE_READ_ONLY',
        message: license.message || 'الترخيص لا يسمح بتنفيذ عمليات تعديل',
      });
    }

    return true;
  }
}
