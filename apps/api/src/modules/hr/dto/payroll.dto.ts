import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsNumber, Min } from 'class-validator';

export class GeneratePayrollPeriodDto {
  @ApiProperty({ description: 'تاريخ بداية الفترة' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'تاريخ نهاية الفترة' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'اسم شهر الراتب' })
  @IsString()
  @IsNotEmpty()
  monthName: string;
}

export class ProcessPayrollPaymentDto {
  @ApiProperty({ description: 'رقم حساب الدفع (النقدية أو البنك)' })
  @IsString()
  @IsNotEmpty()
  paymentAccountId: string;
}

export class RequestAdvanceDto {
  @ApiProperty({ description: 'مبلغ السلفة' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'تاريخ الطلب' })
  @IsDateString()
  requestDate: string;

  @ApiPropertyOptional({ description: 'سبب السلفة' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'رقم الحساب للصرف (نقدية/بنك)' })
  @IsString()
  @IsNotEmpty()
  paymentAccountId: string;
}
