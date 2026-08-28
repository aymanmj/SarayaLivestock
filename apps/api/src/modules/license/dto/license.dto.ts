import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type LicensePlan = 'TRIAL' | 'STANDARD' | 'ENTERPRISE' | 'LIFETIME';

export type LicenseStatus = 
  | 'ACTIVE' 
  | 'WARNING_EXPIRING_SOON' 
  | 'EXPIRED' 
  | 'TAMPERED_CLOCK' 
  | 'UNLICENSED' 
  | 'INVALID_HARDWARE';

export interface LicensePayload {
  licenseId: string;
  companyName: string;
  plan: LicensePlan;
  issuedAt: string;
  expiresAt: string;
  hardwareId: string;
  maxAnimals: number;
  isPerpetual: boolean;
  allowedModules: string[];
}

const LICENSE_PLANS: LicensePlan[] = ['TRIAL', 'STANDARD', 'ENTERPRISE', 'LIFETIME'];
const LICENSE_STATUSES: LicenseStatus[] = [
  'ACTIVE',
  'WARNING_EXPIRING_SOON',
  'EXPIRED',
  'TAMPERED_CLOCK',
  'UNLICENSED',
  'INVALID_HARDWARE',
];

export class LicenseDetailsResponseDto {
  @ApiProperty() licenseId: string;
  @ApiProperty() companyName: string;
  @ApiProperty({ enum: LICENSE_PLANS }) plan: LicensePlan;
  @ApiProperty({ format: 'date-time' }) issuedAt: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: string;
  @ApiProperty({ type: Number }) daysRemaining: number;
  @ApiProperty({ type: Number }) maxAnimals: number;
  @ApiProperty() isPerpetual: boolean;
  @ApiProperty({ type: [String] }) allowedModules: string[];
}

export class LicenseStatusResponseDto {
  @ApiProperty() isValid: boolean;
  @ApiProperty({ enum: LICENSE_STATUSES }) status: LicenseStatus;
  @ApiProperty() message: string;
  @ApiProperty() isReadOnly: boolean;
  @ApiProperty() hardwareId: string;
  @ApiProperty({ type: () => LicenseDetailsResponseDto, required: false }) details?: LicenseDetailsResponseDto;
}

export class HardwareIdResponseDto {
  @ApiProperty() hardwareId: string;
}

export class ActivateLicenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16384)
  licenseKey: string;
}
