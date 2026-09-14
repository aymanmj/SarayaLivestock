import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod, AnimalPricingMethod } from '@prisma/client';

export class RecordMilkSaleDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'يجب أن تكون كمية الحليب أكبر من صفر' })
  liters: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'يجب أن يكون سعر اللتر أكبر من صفر' })
  pricePerLiter: number;

  @IsEnum(PaymentMethod, { message: 'طريقة الدفع غير صالحة' })
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty({ message: 'اسم العميل / المشتري مطلوب' })
  @MaxLength(200)
  buyerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  buyerPhone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البيع غير صالح' })
  saleDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RecordAnimalSaleDto {
  @IsUUID('4', { message: 'معرف الحيوان يجب أن يكون UUID صالح' })
  animalId: string;

  @IsEnum(AnimalPricingMethod, { message: 'طريقة تسعير الحيوان غير صالحة' })
  pricingMethod: AnimalPricingMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1, { message: 'الوزن القائم يجب أن يكون أكبر من صفر' })
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'سعر الكيلو يجب أن يكون أكبر من صفر' })
  pricePerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'سعر الرأس يجب أن يكون أكبر من صفر' })
  pricePerHead?: number;

  @IsEnum(PaymentMethod, { message: 'طريقة الدفع غير صالحة' })
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty({ message: 'اسم العميل / المشتري مطلوب' })
  @MaxLength(200)
  buyerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  buyerPhone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البيع غير صالح' })
  saleDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RecordMortalityDto {
  @IsUUID('4', { message: 'معرف الحيوان يجب أن يكون UUID صالح' })
  animalId: string;

  @IsDateString({}, { message: 'تاريخ النفوق غير صالح' })
  deathDate: string;

  @IsString()
  @IsNotEmpty({ message: 'سبب النفوق مطلوب' })
  @MaxLength(300)
  causeOfDeath: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0, { message: 'قيمة التخريد / الاسترداد يجب ألا تكون سالبة' })
  salvageValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0, { message: 'القيمة الدفترية التقديرية يجب ألا تكون سالبة' })
  estimatedBookValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SalesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
