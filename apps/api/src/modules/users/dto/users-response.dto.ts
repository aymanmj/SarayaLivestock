import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserFarmResponseDto {
  @ApiProperty() name: string;
}

export class UserAdministrationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() username: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ format: 'uuid', nullable: true }) farmId: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: () => UserFarmResponseDto, nullable: true }) farm: UserFarmResponseDto | null;
}

export class UserMutationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() username: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
  @ApiProperty() isActive: boolean;
}

export class ResetPasswordResponseDto {
  @ApiProperty() message: string;
}
