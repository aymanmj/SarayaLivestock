import { Type } from 'class-transformer';
import { AnimalStatus, LifeStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class FindAnimalsQueryDto {
  @IsOptional()
  @IsEnum(AnimalStatus)
  status?: AnimalStatus;

  @IsOptional()
  @IsUUID('4')
  barnId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UpdateAnimalLifeStageDto {
  @IsEnum(LifeStage)
  stage: LifeStage;
}

export class UpdateAnimalBarnDto {
  @IsUUID('4')
  barnId: string;
}

export class UpdateAnimalStatusDto {
  @IsEnum(AnimalStatus)
  status: AnimalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
