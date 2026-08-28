import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() username: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
  @ApiProperty({ format: 'uuid', nullable: true }) farmId: string | null;
}

export class AuthenticationResponseDto {
  @ApiProperty() accessToken: string;
  @ApiPropertyOptional({ description: 'Returned only to the trusted Electron channel.' }) refreshToken?: string;
  @ApiProperty({ type: () => AuthUserResponseDto }) user: AuthUserResponseDto;
  @ApiProperty({ type: [String] }) permissions: string[];
}

export class MessageResponseDto {
  @ApiProperty() message: string;
}

export class LogoutAllResponseDto extends MessageResponseDto {
  @ApiProperty({ type: Number }) sessionsRevoked: number;
}

export class RegisteredUserResponseDto extends AuthUserResponseDto {
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class UserProfileResponseDto extends AuthUserResponseDto {
  @ApiProperty() isActive: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: [String] }) permissions: string[];
}
