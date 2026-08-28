import { ApiProperty } from '@nestjs/swagger';
import { LifeStage, Purpose } from '@prisma/client';

export class DashboardMilkKpisResponseDto {
  @ApiProperty({ type: Number }) total: number;
  @ApiProperty({ type: Number }) usable: number;
  @ApiProperty({ type: Number }) wasted: number;
  @ApiProperty({ type: Number }) cowsMilked: number;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }], example: '18.4' }) avgPerCow: string | number;
}

export class DashboardKpisResponseDto {
  @ApiProperty({ type: Number }) totalAnimals: number;
  @ApiProperty({ type: Number }) lactatingCows: number;
  @ApiProperty({ type: Number }) fatteningAnimals: number;
  @ApiProperty({ type: Number }) quarantineCount: number;
  @ApiProperty({ type: () => DashboardMilkKpisResponseDto }) milk: DashboardMilkKpisResponseDto;
}

export class DashboardAlertsResponseDto {
  @ApiProperty({ type: Number }) quarantineActive: number;
  @ApiProperty({ type: Number }) pendingPdChecks: number;
  @ApiProperty({ type: Number }) pendingDryOffs: number;
  @ApiProperty({ type: Number }) upcomingCalvings: number;
}

export class ExecutiveDashboardResponseDto {
  @ApiProperty({ type: () => DashboardKpisResponseDto }) kpis: DashboardKpisResponseDto;
  @ApiProperty({ type: () => DashboardAlertsResponseDto }) alerts: DashboardAlertsResponseDto;
}

export class MilkEconomicsResponseDto {
  @ApiProperty({ type: Number }) totalMilkLiters: number;
  @ApiProperty({ type: Number }) sellingPricePerLiter: number;
  @ApiProperty({ type: Number }) grossRevenue: number;
  @ApiProperty({ type: Number }) feedCost: number;
  @ApiProperty({ type: Number }) vetCost: number;
  @ApiProperty({ type: Number }) laborAndOverhead: number;
  @ApiProperty({ type: Number }) totalCost: number;
  @ApiProperty({ type: Number }) actualCostPerLiter: number;
  @ApiProperty({ type: Number }) profitPerLiter: number;
  @ApiProperty({ type: Number }) marginPct: number;
}

export class BeefEconomicsResponseDto {
  @ApiProperty({ type: Number }) totalGainKg: number;
  @ApiProperty({ type: Number }) marketPricePerKg: number;
  @ApiProperty({ type: Number }) grossEstimatedRevenue: number;
  @ApiProperty({ type: Number }) feedCost: number;
  @ApiProperty({ type: Number }) totalCost: number;
  @ApiProperty({ type: Number }) costPerKgGain: number;
  @ApiProperty({ type: Number }) profitMarginPct: number;
}

export class FarmProfitAndLossResponseDto {
  @ApiProperty({ type: Number }) totalRevenue: number;
  @ApiProperty({ type: Number }) totalExpenses: number;
  @ApiProperty({ type: Number }) netProfit: number;
  @ApiProperty({ type: Number }) profitMarginPct: number;
}

export class FinancialDataQualityResponseDto {
  @ApiProperty() usesRecordedDataOnly: boolean;
  @ApiProperty() missingPriceConfiguration: boolean;
  @ApiProperty() laborAndOverheadIncluded: boolean;
}

export class FinancialOverviewResponseDto {
  @ApiProperty() period: string;
  @ApiProperty({ type: () => MilkEconomicsResponseDto }) milkEconomics: MilkEconomicsResponseDto;
  @ApiProperty({ type: () => BeefEconomicsResponseDto }) beefEconomics: BeefEconomicsResponseDto;
  @ApiProperty({ type: () => FarmProfitAndLossResponseDto }) farmPnL: FarmProfitAndLossResponseDto;
  @ApiProperty({ type: () => FinancialDataQualityResponseDto }) dataQuality: FinancialDataQualityResponseDto;
}

export class CullingCandidateResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() tagNumber: string;
  @ApiProperty({ nullable: true }) rfidCode: string | null;
  @ApiProperty({ nullable: true }) breed: string | null;
  @ApiProperty({ enum: LifeStage, enumName: 'LifeStage' }) currentLifeStage: LifeStage;
  @ApiProperty({ enum: Purpose, enumName: 'Purpose' }) purpose: Purpose;
  @ApiProperty({ type: [String] }) reasons: string[];
  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'] }) severity: 'HIGH' | 'MEDIUM' | 'LOW';
  @ApiProperty({ type: Number }) estimatedSalvageValue: number;
  @ApiProperty() recommendation: string;
}
