import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaleType, PaymentMethod, AnimalPricingMethod, MilkInventoryPolicy } from '@prisma/client';

const decimalPattern = '^-?\\d+(?:\\.\\d{1,3})?$';

export class AnimalBookValueResponseDto {
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) bookValue: string;
}

export class MortalityAnimalSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() tagNumber: string;
  @ApiPropertyOptional({ nullable: true }) species?: string | null;
  @ApiPropertyOptional({ nullable: true }) breed?: string | null;
  @ApiPropertyOptional({ nullable: true }) gender?: string | null;
}

export class CommercialSaleResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty() invoiceNumber: string;
  @ApiProperty({ format: 'date-time' }) saleDate: string;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' }) saleType: SaleType;
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' }) paymentMethod: PaymentMethod;
  @ApiProperty() buyerName: string;
  @ApiPropertyOptional({ nullable: true }) buyerPhone?: string | null;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;

  @ApiPropertyOptional({ type: String, pattern: decimalPattern, nullable: true }) liters?: string | null;
  @ApiPropertyOptional({ type: String, pattern: decimalPattern, nullable: true }) pricePerLiter?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) animalId?: string | null;
  @ApiPropertyOptional({ enum: AnimalPricingMethod, enumName: 'AnimalPricingMethod', nullable: true }) pricingMethod?: AnimalPricingMethod | null;
  @ApiPropertyOptional({ type: String, pattern: decimalPattern, nullable: true }) weightKg?: string | null;
  @ApiPropertyOptional({ type: String, pattern: decimalPattern, nullable: true }) pricePerKg?: string | null;
  @ApiPropertyOptional({ type: String, pattern: decimalPattern, nullable: true }) pricePerHead?: string | null;

  @ApiProperty({ type: String, pattern: decimalPattern }) totalAmount: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) journalEntryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) createdById?: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class AnimalMortalityResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ format: 'date-time' }) deathDate: string;
  @ApiProperty() causeOfDeath: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) salvageValue: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) bookValue: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) netLoss: string;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) journalEntryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) recordedById?: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiPropertyOptional({ type: () => MortalityAnimalSummaryDto, nullable: true })
  animal?: MortalityAnimalSummaryDto | null;
}

export class SalesSummaryResponseDto {
  @ApiProperty({ type: String, pattern: decimalPattern }) totalSalesLyd: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) milkSalesLyd: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) animalSalesLyd: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) totalMilkLiters: string;
  @ApiProperty({ type: Number }) totalAnimalsSold: number;
  @ApiProperty({ type: String, pattern: decimalPattern }) totalMortalityLossLyd: string;
  @ApiProperty({ type: Number }) totalDeceasedAnimals: number;
  @ApiPropertyOptional({ enum: MilkInventoryPolicy, enumName: 'MilkInventoryPolicy' })
  milkPolicy?: MilkInventoryPolicy;
  @ApiProperty({ type: String, format: 'date', nullable: true }) milkPolicyEffectiveDate: string | null;
}

export class MilkPolicyResponseDto {
  @ApiProperty({ enum: MilkInventoryPolicy, enumName: 'MilkInventoryPolicy' })
  milkPolicy: MilkInventoryPolicy;
  @ApiProperty({ type: String, format: 'date', nullable: true }) effectiveDate: string | null;
}
