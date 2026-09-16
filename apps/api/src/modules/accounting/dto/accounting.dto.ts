import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { AccountCategory, JournalEntryType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @Matches(/^\d{2,20}$/, { message: 'رمز الحساب يجب أن يتكون من 2 إلى 20 رقماً' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @IsEnum(AccountCategory)
  category: AccountCategory;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}

export class JournalLineDto {
  @IsOptional()
  @IsUUID('4')
  animalId?: string;

  @IsUUID('4')
  accountId: string;

  @IsOptional()
  @IsUUID('4')
  costCenterId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  debit: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  credit: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}

export class CreateJournalEntryDto {
  @IsOptional()
  @IsUUID('4')
  fiscalYearId?: string;

  @IsOptional()
  @IsUUID('4')
  fiscalPeriodId?: string;

  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsEnum(JournalEntryType)
  type?: JournalEntryType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceId?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'يجب أن يحتوي القيد على سطرين محاسبيين على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class CreateFiscalYearDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'اسم السنة المالية يجب أن يكون سنة من أربعة أرقام' })
  yearName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class RolloverFiscalYearDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'اسم السنة التالية يجب أن يكون سنة من أربعة أرقام' })
  nextYearName: string;
}

export class JournalEntriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}

export class FinancialReportQueryDto {
  @IsOptional()
  @IsUUID('4')
  fiscalYearId?: string;
}
