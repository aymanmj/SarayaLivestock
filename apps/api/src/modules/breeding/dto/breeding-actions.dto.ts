import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Gender, PregnancyResult } from '@prisma/client';

export class RecordPregnancyResultDto {
  @IsEnum(PregnancyResult)
  result: PregnancyResult;
}

export class RecordCalvingDto {
  @IsDateString()
  actualCalvingDate: string;

  @IsString()
  @Matches(/^[\p{L}\p{N}._/-]{1,50}$/u, { message: 'رقم قرط المولود يحتوي على محارف غير صالحة' })
  offspringTagNumber: string;

  @IsEnum(Gender)
  offspringGender: Gender;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(500)
  offspringWeightKg?: number;
}
