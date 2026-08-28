import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RecordWeightDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsDateString()
  weighDate: string; // YYYY-MM-DD

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(5000)
  weightKg: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
