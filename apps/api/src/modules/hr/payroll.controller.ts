import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { GeneratePayrollPeriodDto, ProcessPayrollPaymentDto } from './dto/payroll.dto';
import { PayrollPeriodResponseDto, PayrollActionResponseDto, PayrollSlipResponseDto } from './dto/payroll-response.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';

@ApiTags('HR - Payroll')
@ApiBearerAuth()
@Controller('hr/payroll')
@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  @DomainAudited()
  @ApiCreatedResponse({ type: PayrollPeriodResponseDto, description: 'تم إنشاء كشوف الرواتب بنجاح' })
  generatePayroll(@CurrentUser() user: AuthenticatedUser, @Body() dto: GeneratePayrollPeriodDto) {
    return this.payrollService.generatePayroll(requireFarmId(user), dto, user);
  }

  @Post(':id/approve')
  @DomainAudited()
  @ApiOkResponse({ type: PayrollPeriodResponseDto, description: 'تم اعتماد كشوف الرواتب' })
  approvePayroll(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payrollService.approvePayroll(requireFarmId(user), id, user);
  }

  @Delete(':id')
  @DomainAudited()
  @ApiOkResponse({ type: PayrollPeriodResponseDto, description: 'تم حذف مسودة الرواتب' })
  deleteDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payrollService.deleteDraft(requireFarmId(user), id, user);
  }

  @Post(':id/pay')
  @DomainAudited()
  @ApiOkResponse({ type: PayrollPeriodResponseDto, description: 'تم صرف الرواتب' })
  payPayroll(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ProcessPayrollPaymentDto) {
    return this.payrollService.payPayroll(requireFarmId(user), id, dto, user);
  }

  @Get('periods')
  @ApiOkResponse({ type: [PayrollPeriodResponseDto], description: 'قائمة فترات الرواتب' })
  findAllPeriods(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.findAllPeriods(requireFarmId(user));
  }

  @Get('periods/:id/slips')
  @ApiOkResponse({ type: [PayrollSlipResponseDto], description: 'تفاصيل القسائم لفترة الراتب' })
  findSlips(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payrollService.findSlips(requireFarmId(user), id);
  }
}
