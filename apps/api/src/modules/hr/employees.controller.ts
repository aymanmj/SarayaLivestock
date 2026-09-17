import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
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
  @ApiCreatedResponse({ description: 'تم إضافة الموظف بنجاح' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(requireFarmId(user), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'قائمة الموظفين' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.findAll(requireFarmId(user));
  }

  @Get(':id')
  @ApiOkResponse({ description: 'بيانات الموظف' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employeesService.findOne(requireFarmId(user), id);
  }

  @Patch(':id')
  @DomainAudited()
  @ApiOkResponse({ description: 'تم تحديث بيانات الموظف' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(requireFarmId(user), id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @ApiOkResponse({ description: 'تم حذف الموظف' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employeesService.remove(requireFarmId(user), id);
  }
}
