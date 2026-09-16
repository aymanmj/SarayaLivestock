import { ApiProperty } from '@nestjs/swagger';
import {
  AnimalRecordResponseDto,
  BreedingRecordResponseDto,
} from '../../animals/dto/animal-response.dto';

export class BreedingRecordWithAnimalResponseDto extends BreedingRecordResponseDto {
  @ApiProperty({ type: () => AnimalRecordResponseDto })
  animal: AnimalRecordResponseDto;
}

export class RecordCalvingResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ format: 'uuid' })
  motherId: string;

  @ApiProperty({ type: () => AnimalRecordResponseDto, nullable: true })
  newborn: AnimalRecordResponseDto | null;

  @ApiProperty({ type: () => [AnimalRecordResponseDto] })
  newborns: AnimalRecordResponseDto[];
}

export class BreedingTasksResponseDto {
  @ApiProperty({ type: () => [BreedingRecordWithAnimalResponseDto] })
  pendingPdChecks: BreedingRecordWithAnimalResponseDto[];

  @ApiProperty({ type: () => [BreedingRecordWithAnimalResponseDto] })
  pendingDryOffs: BreedingRecordWithAnimalResponseDto[];

  @ApiProperty({ type: () => [BreedingRecordWithAnimalResponseDto] })
  upcomingCalvings: BreedingRecordWithAnimalResponseDto[];
}
