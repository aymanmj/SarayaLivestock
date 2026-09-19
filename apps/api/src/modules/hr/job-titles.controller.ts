import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { JobTitlesService } from './job-titles.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';

class CreateJobTitleDto {
  title: string;
}

class UpdateJobTitleDto {
  newTitle: string;
}

@ApiTags('HR - Job Titles')
@ApiBearerAuth()
@Controller('hr/job-titles')
@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
export class JobTitlesController {
  constructor(private readonly jobTitlesService: JobTitlesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة المسميات الوظيفية المتاحة بالمزرعة' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.jobTitlesService.findAll(requireFarmId(user));
  }

  @Post()
  @DomainAudited()
  @ApiCreatedResponse({ description: 'تمت إضافة مسمى وظيفي جديد بنجاح' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobTitleDto,
  ) {
    return this.jobTitlesService.create(requireFarmId(user), dto.title, user);
  }

  @Patch(':title')
  @DomainAudited()
  @ApiOkResponse({ description: 'تم تعديل المسمى الوظيفي بنجاح' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('title') title: string,
    @Body() dto: UpdateJobTitleDto,
  ) {
    return this.jobTitlesService.update(requireFarmId(user), decodeURIComponent(title), dto.newTitle, user);
  }

  @Delete(':title')
  @DomainAudited()
  @ApiOkResponse({ description: 'تم حذف المسمى الوظيفي بنجاح' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('title') title: string,
  ) {
    return this.jobTitlesService.delete(requireFarmId(user), decodeURIComponent(title), user);
  }
}
