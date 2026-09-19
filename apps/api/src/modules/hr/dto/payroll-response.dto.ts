import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollStatus } from '@prisma/client';
import { EmployeeResponseDto } from './employee-response.dto';

export class PayrollPeriodResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  farmId: string;

  @ApiProperty()
  fiscalPeriodId: string;

  @ApiProperty()
  monthName: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ enum: PayrollStatus })
  status: PayrollStatus;

  @ApiPropertyOptional()
  journalEntryId?: string | null;

  @ApiPropertyOptional()
  totalBaseSalary?: number;

  @ApiPropertyOptional()
  totalBonuses?: number;

  @ApiPropertyOptional()
  totalDeductions?: number;

  @ApiPropertyOptional()
  totalAdvancesSettled?: number;

  @ApiPropertyOptional()
  totalNetSalary?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PayrollSlipResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  periodId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  baseSalary: number | string | any;

  @ApiPropertyOptional()
  bonuses?: number | string | any;

  @ApiPropertyOptional()
  deductions?: number | string | any;

  @ApiProperty()
  advancesSettled: number | string | any;

  @ApiProperty()
  netSalary: number | string | any;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ type: () => EmployeeResponseDto })
  employee?: EmployeeResponseDto;
}

export class PayrollActionResponseDto {
  @ApiProperty()
  id?: string;
  @ApiProperty()
  status?: string;
}

export class AdvanceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  requestDate: Date;

  @ApiProperty()
  amount: number | string | any;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty()
  settledAmount: number | string | any;

  @ApiProperty()
  isSettled: boolean;

  @ApiPropertyOptional()
  settledPeriodId?: string | null;

  @ApiPropertyOptional()
  journalEntryId?: string | null;

  @ApiProperty()
  createdAt: Date;
}
