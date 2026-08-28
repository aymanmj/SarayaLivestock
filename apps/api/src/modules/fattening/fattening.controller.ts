import { Controller, Get, Post, Body } from '@nestjs/common';
import { FatteningService } from './fattening.service';
import { RecordWeightDto } from './dto/record-weight.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { FatteningPerformanceResponseDto, RecordedWeightResponseDto } from './dto/fattening-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.WORKER)
@Controller('fattening')
export class FatteningController {
  constructor(private readonly fatteningService: FatteningService) {}

  @Post('weight')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: RecordedWeightResponseDto })
  recordWeight(
    @Body() dto: RecordWeightDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.fatteningService.recordWeight(dto, requireFarmId(user), user, idempotency);
  }

  @Get('performance')
  @ApiOkResponse({ type: FatteningPerformanceResponseDto, isArray: true })
  getPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.fatteningService.getFatteningPerformance(requireFarmId(user));
  }
}
