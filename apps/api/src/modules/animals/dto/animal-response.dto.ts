import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnimalStatus,
  CalvingDifficulty,
  Gender,
  InseminationType,
  LifeStage,
  MilkingShift,
  PregnancyResult,
  Purpose,
  SectorType,
  Species,
} from '@prisma/client';

const decimalPattern = '^-?\\d+(?:\\.\\d{1,3})?$';

export class BarnResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  farmId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: SectorType, enumName: 'SectorType' })
  sectorType: SectorType;

  @ApiProperty({ type: Number })
  capacity: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class AnimalCountResponseDto {
  @ApiProperty({ type: Number })
  milkLogs: number;

  @ApiProperty({ type: Number })
  weightLogs: number;

  @ApiProperty({ type: Number })
  breedingRecords: number;

  @ApiProperty({ type: Number })
  healthTreatments: number;
}

export class AnimalRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  farmId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  barnId: string | null;

  @ApiProperty()
  tagNumber: string;

  @ApiProperty({ nullable: true })
  rfidTag: string | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ enum: Species, enumName: 'Species' })
  species: Species;

  @ApiProperty({ nullable: true })
  breed: string | null;

  @ApiProperty({ enum: Gender, enumName: 'Gender' })
  gender: Gender;

  @ApiProperty({ enum: Purpose, enumName: 'Purpose' })
  purpose: Purpose;

  @ApiProperty({ enum: AnimalStatus, enumName: 'AnimalStatus' })
  status: AnimalStatus;

  @ApiProperty({ enum: LifeStage, enumName: 'LifeStage' })
  currentLifeStage: LifeStage;

  @ApiProperty({ format: 'date-time', nullable: true })
  birthDate: string | null;

  @ApiProperty({ format: 'date-time' })
  entryDate: string;

  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true, example: '550.000' })
  entryWeightKg: string | null;

  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true, example: '7250.000' })
  purchasePrice: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  motherId: string | null;

  @ApiProperty({ nullable: true })
  fatherSemenCode: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  withdrawalEndDate: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class AnimalResponseDto extends AnimalRecordResponseDto {
  @ApiPropertyOptional({ type: () => BarnResponseDto, nullable: true })
  barn?: BarnResponseDto | null;

  @ApiPropertyOptional({ type: () => AnimalRecordResponseDto, nullable: true })
  mother?: AnimalRecordResponseDto | null;

  @ApiPropertyOptional({ type: () => AnimalCountResponseDto })
  _count?: AnimalCountResponseDto;
}

export class MilkLogResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ format: 'date-time' }) logDate: string;
  @ApiProperty({ enum: MilkingShift, enumName: 'MilkingShift' }) shift: MilkingShift;
  @ApiProperty({ type: String, pattern: decimalPattern }) yieldLiters: string;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) fatPct: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) proteinPct: string | null;
  @ApiProperty() isDiscarded: boolean;
  @ApiProperty({ nullable: true }) discardReason: string | null;
  @ApiProperty({ nullable: true }) loggedByUserId: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class WeightLogResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ format: 'date-time' }) weighDate: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) weightKg: string;
  @ApiProperty({ type: String, pattern: decimalPattern, nullable: true }) dailyGainAdg: string | null;
  @ApiProperty({ type: Number, nullable: true }) daysSinceLast: number | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class BreedingRecordResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ format: 'date-time' }) inseminationDate: string;
  @ApiProperty({ enum: InseminationType, enumName: 'InseminationType' }) inseminationType: InseminationType;
  @ApiProperty({ nullable: true }) semenCode: string | null;
  @ApiProperty({ nullable: true }) inseminatorName: string | null;
  @ApiProperty({ enum: PregnancyResult, enumName: 'PregnancyResult' }) pdResult: PregnancyResult;
  @ApiProperty({ format: 'date-time', nullable: true }) pdCheckDate: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) expectedDryoffDate: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) expectedCalvingDate: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) actualCalvingDate: string | null;
  @ApiProperty({ enum: CalvingDifficulty, enumName: 'CalvingDifficulty', nullable: true }) calvingDifficulty: CalvingDifficulty | null;
  @ApiProperty({ type: Number }) offspringCount: number;
  @ApiProperty({ enum: Gender, enumName: 'Gender', nullable: true }) offspringGender: Gender | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class HealthTreatmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) animalId: string;
  @ApiProperty({ format: 'date-time' }) treatmentDate: string;
  @ApiProperty() diagnosis: string;
  @ApiProperty() drugName: string;
  @ApiProperty() dosage: string;
  @ApiProperty({ type: Number }) milkWithdrawalDays: number;
  @ApiProperty({ type: Number }) meatWithdrawalDays: number;
  @ApiProperty({ format: 'date-time', nullable: true }) withdrawalEndDate: string | null;
  @ApiProperty({ nullable: true }) vetName: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern }) treatmentCost: string;
  @ApiProperty() isCompleted: boolean;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AnimalDetailResponseDto extends AnimalResponseDto {
  @ApiProperty({ type: () => [AnimalRecordResponseDto] })
  children: AnimalRecordResponseDto[];

  @ApiProperty({ type: () => [MilkLogResponseDto] })
  milkLogs: MilkLogResponseDto[];

  @ApiProperty({ type: () => [WeightLogResponseDto] })
  weightLogs: WeightLogResponseDto[];

  @ApiProperty({ type: () => [BreedingRecordResponseDto] })
  breedingRecords: BreedingRecordResponseDto[];

  @ApiProperty({ type: () => [HealthTreatmentResponseDto] })
  healthTreatments: HealthTreatmentResponseDto[];
}

export class BarnAnimalCountResponseDto {
  @ApiProperty({ type: Number })
  animals: number;
}

export class BarnSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: SectorType, enumName: 'SectorType' })
  sectorType: SectorType;

  @ApiProperty({ type: Number })
  capacity: number;

  @ApiProperty({ type: () => BarnAnimalCountResponseDto })
  _count: BarnAnimalCountResponseDto;
}
