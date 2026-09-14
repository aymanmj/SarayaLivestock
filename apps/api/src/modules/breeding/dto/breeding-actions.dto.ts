import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { CalvingDifficulty, Gender, PregnancyResult } from '@prisma/client';

export class RecordPregnancyResultDto {
  @IsEnum(PregnancyResult)
  result: PregnancyResult;
}

export class TwinOffspringDto {
  @IsString()
  @Matches(/^[\p{L}\p{N}._/-]{1,50}$/u, { message: 'رقم قرط المولود الإضافي يحتوي على محارف غير صالحة' })
  tagNumber: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(500)
  weightKg?: number;
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

  @IsOptional()
  @IsEnum(CalvingDifficulty)
  calvingDifficulty?: CalvingDifficulty;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TwinOffspringDto)
  twins?: TwinOffspringDto[];
}
