import { Controller, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { FarmsService } from './farms.service';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';

@ApiTags('Farms')
@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @ApiOkResponse({ description: 'تم تحديث بيانات المزرعة بنجاح' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
  ) {
    return this.farmsService.update(id, dto);
  }
}
