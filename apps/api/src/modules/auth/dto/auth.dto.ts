import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  @IsOptional()
  refreshToken?: string;
}

export class RegisterUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و . _ - فقط',
  })
  username: string;

  @IsString()
  @MinLength(12, { message: 'كلمة المرور يجب ألا تقل عن 12 حرفاً' })
  @MaxLength(200)
  password: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsUUID('4')
  @IsOptional()
  farmId?: string;
}
