import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeeResponseDto, EmployeeDeleteResponseDto } from './dto/employee-response.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';

@ApiTags('HR - Employees')
@ApiBearerAuth()
@Controller('hr/employees')
@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @DomainAudited()
  @ApiCreatedResponse({ type: EmployeeResponseDto, description: 'تم إضافة الموظف بنجاح' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    const farmId = requireFarmId(user);
    return this.employeesService.create(farmId, dto,
      { id: user.id, orgId: user.orgId, farmId });
  }

  @Get()
  @ApiOkResponse({ type: [EmployeeResponseDto], description: 'قائمة الموظفين' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.findAll(requireFarmId(user));
  }

  @Get(':id')
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'بيانات الموظف' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employeesService.findOne(requireFarmId(user), id);
  }

  @Patch(':id')
  @DomainAudited()
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'تم تحديث بيانات الموظف' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    const farmId = requireFarmId(user);
    return this.employeesService.update(farmId, id, dto,
      { id: user.id, orgId: user.orgId, farmId });
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @ApiOkResponse({ type: EmployeeDeleteResponseDto, description: 'تم حذف الموظف' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const farmId = requireFarmId(user);
    return this.employeesService.remove(farmId, id,
      { id: user.id, orgId: user.orgId, farmId });
  }
}
