import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdvancesService } from './advances.service';
import { RequestAdvanceDto } from './dto/payroll.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';

@ApiTags('HR - Advances')
@ApiBearerAuth()
@Controller('hr/advances')
@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Post(':employeeId')
  @DomainAudited()
  @ApiCreatedResponse({ description: 'تم صرف السلفة بنجاح' })
  requestAdvance(@CurrentUser() user: AuthenticatedUser, @Param('employeeId') employeeId: string, @Body() dto: RequestAdvanceDto) {
    return this.advancesService.requestAdvance(requireFarmId(user), employeeId, dto, user);
  }

  @Get()
  @ApiOkResponse({ description: 'قائمة السلف' })
  findAllAdvances(@CurrentUser() user: AuthenticatedUser) {
    return this.advancesService.findAllAdvances(requireFarmId(user));
  }
}
