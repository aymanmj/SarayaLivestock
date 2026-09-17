import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'الرقم الوظيفي أو رمز البصمة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeCode: string;

  @ApiProperty({ description: 'الاسم الأول' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'اسم العائلة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ description: 'المسمى الوظيفي' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobTitle: string;

  @ApiPropertyOptional({ description: 'الرقم القومي / الهوية' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nationalId?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ description: 'تاريخ التعيين' })
  @IsDateString()
  hireDate: string;

  @ApiProperty({ description: 'الراتب الأساسي' })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'رقم الحساب البنكي' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'ملاحظات' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'الرقم الوظيفي أو رمز البصمة' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional({ description: 'الاسم الأول' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'اسم العائلة' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'المسمى الوظيفي' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'الرقم القومي / الهوية' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nationalId?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'الراتب الأساسي' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'رقم الحساب البنكي' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'ملاحظات' })
  @IsString()
  @IsOptional()
  notes?: string;
}
