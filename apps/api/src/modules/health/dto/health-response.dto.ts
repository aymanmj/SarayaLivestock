import { ApiProperty } from '@nestjs/swagger';
import {
  AnimalResponseDto,
  HealthTreatmentResponseDto,
} from '../../animals/dto/animal-response.dto';

export class RecordTreatmentResponseDto {
  @ApiProperty({ type: () => HealthTreatmentResponseDto })
  treatment: HealthTreatmentResponseDto;

  @ApiProperty()
  warningMessage: string;
}

export class QuarantinedAnimalResponseDto extends AnimalResponseDto {
  @ApiProperty({ type: () => [HealthTreatmentResponseDto] })
  healthTreatments: HealthTreatmentResponseDto[];
}
