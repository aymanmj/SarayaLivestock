import { ApiProperty } from '@nestjs/swagger';
import { AnimalRecordResponseDto, WeightLogResponseDto } from '../../animals/dto/animal-response.dto';

export class RecordedWeightResponseDto extends WeightLogResponseDto {
  @ApiProperty({ type: () => AnimalRecordResponseDto }) animal: AnimalRecordResponseDto;
}

export class FatteningPerformanceResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() tagNumber: string;
  @ApiProperty({ nullable: true }) breed: string | null;
  @ApiProperty({ nullable: true }) barn: string | null;
  @ApiProperty({ type: Number, nullable: true }) entryWeightKg: number | null;
  @ApiProperty({ type: Number, nullable: true }) currentWeightKg: number | null;
  @ApiProperty({ format: 'date', nullable: true }) lastWeighDate: string | null;
  @ApiProperty({ type: Number, nullable: true }) adgKgPerDay: number | null;
  @ApiProperty({ type: Number, nullable: true }) totalGainKg: number | null;
}
