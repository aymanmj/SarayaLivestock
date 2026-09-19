import { Controller, Get, Patch, Param, Body, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FarmsService } from './farms.service';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmResponseDto } from './dto/farm-response.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/authenticated-user';

@ApiTags('Farms')
@ApiBearerAuth()
@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get('current')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FARM_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.VETERINARIAN,
    UserRole.MILKER,
    UserRole.WORKER,
  )
  @ApiOkResponse({ type: FarmResponseDto, description: 'بيانات المزرعة الحالية' })
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.getCurrent(user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
  @ApiOkResponse({ type: FarmResponseDto, description: 'بيانات المزرعة بالمعرف' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.farmsService.findOne(id, user);
  }

  @Patch('current')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @ApiOkResponse({ type: FarmResponseDto, description: 'تم تحديث بيانات المزرعة بنجاح' })
  async updateCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFarmDto,
  ) {
    return this.farmsService.update('current', dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @ApiOkResponse({ type: FarmResponseDto, description: 'تم تحديث بيانات المزرعة بنجاح' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
  ) {
    return this.farmsService.update(id, dto, user);
  }
}
