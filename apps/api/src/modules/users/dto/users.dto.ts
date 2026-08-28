import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(12, { message: 'كلمة المرور يجب ألا تقل عن 12 حرفاً' })
  @MaxLength(200)
  password: string;
}
