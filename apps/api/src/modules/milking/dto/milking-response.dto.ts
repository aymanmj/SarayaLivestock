import { ApiProperty } from '@nestjs/swagger';
import {
  AnimalRecordResponseDto,
  MilkLogResponseDto,
} from '../../animals/dto/animal-response.dto';

export class MilkLogWithAnimalResponseDto extends MilkLogResponseDto {
  @ApiProperty({ type: () => AnimalRecordResponseDto })
  animal: AnimalRecordResponseDto;
}

export class RecordMilkResponseDto {
  @ApiProperty({ type: () => MilkLogWithAnimalResponseDto })
  milkLog: MilkLogWithAnimalResponseDto;

  @ApiProperty({ nullable: true })
  safetyWarning: string | null;

  @ApiProperty({ nullable: true })
  healthAlert: string | null;
}

export class DailyMilkingSummaryResponseDto {
  @ApiProperty({ format: 'date' })
  date: string;

  @ApiProperty({ type: Number })
  totalLiters: number;

  @ApiProperty({ type: Number })
  usableLiters: number;

  @ApiProperty({ type: Number })
  discardedLiters: number;

  @ApiProperty({ type: Number })
  cowsMilkedCount: number;

  @ApiProperty({ type: String, example: '18.25' })
  averagePerCow: string;

  @ApiProperty({ type: () => [MilkLogWithAnimalResponseDto] })
  logs: MilkLogWithAnimalResponseDto[];
}
