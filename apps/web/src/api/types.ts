export type Species = 'CATTLE' | 'SHEEP' | 'GOAT';
export type Gender = 'FEMALE' | 'MALE';
export type Purpose = 'DAIRY' | 'BEEF' | 'DUAL' | 'BREEDING';
export type AnimalStatus = 'ACTIVE' | 'SOLD' | 'CULLED' | 'DECEASED' | 'QUARANTINED';
export type LifeStage = 'CALF' | 'WEANED' | 'HEIFER' | 'PREGNANT_HEIFER' | 'LACTATING' | 'DRY' | 'FATTENING' | 'SIRE';
export type MilkingShift = 'MORNING' | 'NOON' | 'EVENING';
export type InseminationType = 'ARTIFICIAL' | 'NATURAL';
export type PregnancyResult = 'PENDING' | 'PREGNANT' | 'OPEN';

export type Animal = components['schemas']['AnimalResponseDto'];
export type AnimalDetail = components['schemas']['AnimalDetailResponseDto'];

export type MilkLog = components['schemas']['MilkLogWithAnimalResponseDto'];
export type BreedingRecord = components['schemas']['BreedingRecordWithAnimalResponseDto'];
export type HealthTreatment = components['schemas']['HealthTreatmentResponseDto'];
export type BreedingTasks = components['schemas']['BreedingTasksResponseDto'];
export type QuarantinedAnimal = components['schemas']['QuarantinedAnimalResponseDto'];

export type FatteningLog = components['schemas']['RecordedWeightResponseDto'];
export type FatteningPerformance = components['schemas']['FatteningPerformanceResponseDto'];

export type DashboardKPIs = components['schemas']['DashboardKpisResponseDto'];
export type DashboardAlerts = components['schemas']['DashboardAlertsResponseDto'];
export type DashboardData = components['schemas']['ExecutiveDashboardResponseDto'];
export type FeedIngredient = components['schemas']['FeedIngredientResponseDto'];
export type FeedFormulaItem = components['schemas']['FeedFormulaItemResponseDto'];
export type FeedFormula = components['schemas']['FeedFormulaResponseDto'];
export type FeedDistribution = components['schemas']['FeedDistributionResponseDto'];
export type LeastCostResult = components['schemas']['LeastCostRationResponseDto'];
export type FinancialOverviewData = components['schemas']['FinancialOverviewResponseDto'];
export type CullingCandidate = components['schemas']['CullingCandidateResponseDto'];
export type BarnSummary = components['schemas']['BarnSummaryResponseDto'];
import type { components } from './generated/schema';
