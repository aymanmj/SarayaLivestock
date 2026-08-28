import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { InseminationType } from '@prisma/client';

export class InseminateDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsDateString()
  inseminationDate: string; // YYYY-MM-DD

  @IsEnum(InseminationType)
  @IsOptional()
  inseminationType?: InseminationType = InseminationType.ARTIFICIAL;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  semenCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  inseminatorName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
