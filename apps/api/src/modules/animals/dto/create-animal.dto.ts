import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Species, Gender, Purpose, LifeStage } from '@prisma/client';

export class CreateAnimalDto {
  @IsUUID('4')
  @IsOptional()
  barnId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[\p{L}\p{N}._/-]{1,50}$/u, { message: 'رقم القرط يحتوي على محارف غير صالحة' })
  tagNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  rfidTag?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsEnum(Species)
  @IsOptional()
  species?: Species = Species.CATTLE;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  breed?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender = Gender.FEMALE;

  @IsEnum(Purpose)
  @IsOptional()
  purpose?: Purpose = Purpose.DAIRY;

  @IsEnum(LifeStage)
  @IsOptional()
  currentLifeStage?: LifeStage = LifeStage.CALF;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.1)
  @Max(5000)
  entryWeightKg?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @IsUUID('4')
  @IsOptional()
  motherId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  fatherSemenCode?: string;
}
