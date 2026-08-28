import { ApiProperty } from '@nestjs/swagger';
import { SectorType } from '@prisma/client';
import { BarnResponseDto } from '../../animals/dto/animal-response.dto';

const decimalPattern = '^-?\\d+(?:\\.\\d{1,3})?$';

export class FeedIngredientResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty() name: string;
  @ApiProperty() unit: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) currentStock: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) minStockAlert: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) costPerUnit: string;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) dryMatterPct: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) proteinPct: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) energyMcal: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class FeedFormulaItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) formulaId: string;
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) percentage: string;
  @ApiProperty({ type: () => FeedIngredientResponseDto }) ingredient: FeedIngredientResponseDto;
}

export class FeedFormulaRecordResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: SectorType, enumName: 'SectorType' }) targetSector: SectorType;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class FeedFormulaResponseDto extends FeedFormulaRecordResponseDto {
  @ApiProperty({ type: () => [FeedFormulaItemResponseDto] })
  items: FeedFormulaItemResponseDto[];
}

export class FeedDistributionRecordResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) barnId: string;
  @ApiProperty({ format: 'uuid' }) formulaId: string;
  @ApiProperty({ format: 'date-time' }) dispenseDate: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) quantityKg: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) totalCost: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class FeedDistributionResponseDto extends FeedDistributionRecordResponseDto {
  @ApiProperty({ type: () => BarnResponseDto }) barn: BarnResponseDto;
  @ApiProperty({ type: () => FeedFormulaRecordResponseDto }) formula: FeedFormulaRecordResponseDto;
}

export class LeastCostRationItemResponseDto {
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: Number }) percentage: number;
  @ApiProperty({ type: Number }) weightKg: number;
  @ApiProperty({ type: Number }) cost: number;
}

export class LeastCostRationResponseDto {
  @ApiProperty({ type: Number }) targetProteinPct: number;
  @ApiProperty({ type: Number }) actualProteinPct: number;
  @ApiProperty({ type: Number }) batchTotalKg: number;
  @ApiProperty({ type: Number }) totalCost: number;
  @ApiProperty({ type: Number }) costPerKg: number;
  @ApiProperty({ type: Number }) costPerTon: number;
  @ApiProperty({ type: () => [LeastCostRationItemResponseDto] }) items: LeastCostRationItemResponseDto[];
}

export class DispenseFeedResponseDto {
  @ApiProperty() message: string;
  @ApiProperty({ type: () => FeedDistributionRecordResponseDto }) distribution: FeedDistributionRecordResponseDto;
  @ApiProperty({ type: Number }) totalCost: number;
  @ApiProperty({ type: String, example: '0.425' }) costPerKg: string;
}
