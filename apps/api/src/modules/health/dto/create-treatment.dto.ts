import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTreatmentDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  diagnosis: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  drugName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dosage: string;

  @IsDateString()
  treatmentDate: string; // YYYY-MM-DD

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  @IsNumber()
  @IsOptional()
  milkWithdrawalDays?: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  @IsNumber()
  @IsOptional()
  meatWithdrawalDays?: number = 0;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  vetName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  treatmentCost?: number = 0;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;
}
