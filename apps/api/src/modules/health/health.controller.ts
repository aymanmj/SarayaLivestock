import { Controller, Get, Post, Body } from '@nestjs/common';
import { HealthService } from './health.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { QuarantinedAnimalResponseDto, RecordTreatmentResponseDto } from './dto/health-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Post('treatment')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: RecordTreatmentResponseDto })
  recordTreatment(
    @Body() dto: CreateTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.healthService.recordTreatment(dto, requireFarmId(user), user, idempotency);
  }

  @Get('quarantine-list')
  @ApiOkResponse({ type: QuarantinedAnimalResponseDto, isArray: true })
  getActiveQuarantineList(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getActiveQuarantineList(requireFarmId(user));
  }
}
