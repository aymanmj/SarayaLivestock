import { Controller, Get, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { BarnsService } from './barns.service';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { BarnSummaryResponseDto } from '../animals/dto/animal-response.dto';
import { CreateBarnDto } from './dto/create-barn.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';

@Controller('barns')
export class BarnsController {
  constructor(private readonly barnsService: BarnsService) {}

  @Get()
  @ApiOkResponse({ type: BarnSummaryResponseDto, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.barnsService.findAll(requireFarmId(user));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: BarnSummaryResponseDto })
  create(
    @Body() dto: CreateBarnDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.barnsService.createBarn(requireFarmId(user), dto, user, idempotency);
  }
}
