import { Controller, Get, Post, Body } from '@nestjs/common';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/license.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { AllowUnlicensedWrite } from './license-access.decorator';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { HardwareIdResponseDto, LicenseStatusResponseDto } from './dto/license.dto';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('info')
  @ApiOkResponse({ type: LicenseStatusResponseDto })
  getLicenseInfo() {
    return this.licenseService.checkLicenseStatus();
  }

  @Get('hardware-id')
  @ApiOkResponse({ type: HardwareIdResponseDto })
  getHardwareId() {
    return this.licenseService.getHardwareId();
  }

  @Post('activate')
  @Roles(UserRole.SUPER_ADMIN)
  @AllowUnlicensedWrite()
  @ApiCreatedResponse({ type: LicenseStatusResponseDto })
  activateLicense(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activateLicense(dto);
  }

}
