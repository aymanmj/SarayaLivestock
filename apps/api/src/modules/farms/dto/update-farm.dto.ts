import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateFarmDto {
  @ApiPropertyOptional({ description: 'اسم المنشأة / المزرعة' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'الموقع / العنوان' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'اسم المدير' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  managerName?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;
}
