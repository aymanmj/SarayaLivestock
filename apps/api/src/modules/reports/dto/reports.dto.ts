import { IsEnum } from 'class-validator';

export enum ReportExportType {
  ANIMALS = 'animals',
  MILKING = 'milking',
  BREEDING = 'breeding',
  NUTRITION = 'nutrition',
  CULLING = 'culling',
}

export class ReportExportParamsDto {
  @IsEnum(ReportExportType)
  type: ReportExportType;
}
