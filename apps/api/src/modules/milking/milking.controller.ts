import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { MilkingService } from './milking.service';
import { LogMilkDto } from './dto/log-milk.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { MilkingSummaryQueryDto } from './dto/milking-query.dto';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { DailyMilkingSummaryResponseDto, RecordMilkResponseDto } from './dto/milking-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.MILKER)
@Controller('milking')
export class MilkingController {
  constructor(private readonly milkingService: MilkingService) {}

  @Post('log')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: RecordMilkResponseDto })
  logMilk(
    @Body() dto: LogMilkDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.milkingService.logMilk(dto, requireFarmId(user), user, idempotency);
  }

  @Get('daily-summary')
  @ApiOkResponse({ type: DailyMilkingSummaryResponseDto })
  getDailySummary(@CurrentUser() user: AuthenticatedUser, @Query() query: MilkingSummaryQueryDto) {
    return this.milkingService.getDailyFarmSummary(requireFarmId(user), query.date || new Date().toISOString().split('T')[0]);
  }
}
