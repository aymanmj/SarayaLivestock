import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FarmResponseDto {
  @ApiProperty({ description: 'معرّف المزرعة' })
  id: string;

  @ApiProperty({ description: 'معرّف المؤسسة' })
  orgId: string;

  @ApiProperty({ description: 'اسم المنشأة / المزرعة' })
  name: string;

  @ApiPropertyOptional({ description: 'الموقع / العنوان' })
  location?: string;

  @ApiPropertyOptional({ description: 'اسم المدير' })
  managerName?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف' })
  phone?: string;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;

  @ApiProperty({ description: 'تاريخ التحديث' })
  updatedAt: Date;
}
