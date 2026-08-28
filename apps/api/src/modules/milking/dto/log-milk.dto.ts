import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, IsDateString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MilkingShift } from '@prisma/client';

export class LogMilkDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsDateString()
  logDate: string; // YYYY-MM-DD

  @IsEnum(MilkingShift)
  @IsOptional()
  shift?: MilkingShift = MilkingShift.MORNING;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1000)
  yieldLiters: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  fatPct?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  proteinPct?: number;

  @IsBoolean()
  @IsOptional()
  isDiscarded?: boolean;

  @ValidateIf(dto => dto.isDiscarded === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  discardReason?: string;
}
