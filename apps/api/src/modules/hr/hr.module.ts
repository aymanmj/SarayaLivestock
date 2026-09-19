import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';
import { JobTitlesController } from './job-titles.controller';
import { JobTitlesService } from './job-titles.service';
import { DatabaseModule } from '../../database/database.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [DatabaseModule, AccountingModule],
  controllers: [EmployeesController, PayrollController, AdvancesController, JobTitlesController],
  providers: [EmployeesService, PayrollService, AdvancesService, JobTitlesService],
  exports: [EmployeesService, JobTitlesService],
})
export class HrModule {}
