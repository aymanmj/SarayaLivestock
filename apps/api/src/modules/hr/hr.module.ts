import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';
import { DatabaseModule } from '../../database/database.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [DatabaseModule, AccountingModule],
  controllers: [EmployeesController, PayrollController, AdvancesController],
  providers: [EmployeesService, PayrollService, AdvancesService],
  exports: [EmployeesService],
})
export class HrModule {}
