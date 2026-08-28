import { Controller, Get, Post, Body } from '@nestjs/common';
import { VaultService } from './vault.service';
import { UserRole } from '@prisma/client';
import { Roles } from '../../modules/auth/roles.decorator';
import { RotateSecretDto } from './dto/rotate-secret.dto';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { RotateSecretResponseDto, VaultStatusResponseDto } from './dto/security-response.dto';

@Roles(UserRole.SUPER_ADMIN)
@Controller('security')
export class SecurityController {
  constructor(private readonly vaultService: VaultService) {}

  @Get('vault-status')
  @ApiOkResponse({ type: VaultStatusResponseDto })
  getVaultStatus() {
    return this.vaultService.getVaultStatus();
  }

  @Post('rotate-secret')
  @ApiCreatedResponse({ type: RotateSecretResponseDto })
  rotateSecret(@Body() dto: RotateSecretDto) {
    return this.vaultService.rotateSecret(dto.keyName);
  }
}
