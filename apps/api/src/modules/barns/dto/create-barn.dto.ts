import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SectorType } from '@prisma/client';

export class CreateBarnDto {
  @ApiProperty({ description: 'اسم الحظيرة أو العنبر', example: 'حظيرة الأبقار الحلابة (A2)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: SectorType, description: 'نوع القطاع', default: SectorType.DAIRY })
  @IsOptional()
  @IsEnum(SectorType)
  sectorType?: SectorType;

  @ApiPropertyOptional({ description: 'الطاقة الاستيعابية للحظيرة', default: 50, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  capacity?: number;
}
