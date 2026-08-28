import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { SectorType } from '@prisma/client';

export class RationIngredientInputDto {
  @IsUUID('4') id: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) costPerKg: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) proteinPct: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) energyMcal: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) minInclusionPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) maxInclusionPct?: number;
}

export class FormulationTargetDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) targetProteinPct: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) batchTotalKg: number;
}

export class FormulateLeastCostDto {
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RationIngredientInputDto)
  ingredients: RationIngredientInputDto[];
  @ValidateNested() @Type(() => FormulationTargetDto) target: FormulationTargetDto;
}

export class DispenseFeedDto {
  @IsUUID('4') barnId: string;
  @IsUUID('4') formulaId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantityKg: number;
}

export class CreateFeedIngredientDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) currentStock: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) minStockAlert?: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) costPerUnit: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) dryMatterPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) proteinPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) energyMcal?: number;
}

export class UpdateFeedStockDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) addedKg: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) costPerUnit?: number;
}

export class FeedFormulaItemDto {
  @IsUUID('4') ingredientId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) percentage: number;
}

export class CreateFeedFormulaDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsEnum(SectorType) targetSector?: SectorType;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FeedFormulaItemDto)
  items: FeedFormulaItemDto[];
}
