import { ApiProperty } from '@nestjs/swagger';

export const SECRET_SOURCES = ['HASHICORP_VAULT', 'ENVIRONMENT'] as const;
export type SecretSource = (typeof SECRET_SOURCES)[number];

export class SecretMetadataResponseDto {
  @ApiProperty() keyName: string;
  @ApiProperty({ type: Number }) version: number;
  @ApiProperty({ format: 'date-time' }) lastRotated: string;
  @ApiProperty({ enum: SECRET_SOURCES }) source: SecretSource;
  @ApiProperty() rotationAvailable: boolean;
  @ApiProperty({ nullable: true }) rotationUnavailableReason: string | null;
}

export class SecretAuditLogResponseDto {
  @ApiProperty({ format: 'date-time' }) timestamp: string;
  @ApiProperty() action: string;
  @ApiProperty() key: string;
  @ApiProperty() status: string;
}

export class VaultStatusResponseDto {
  @ApiProperty() isVaultOnline: boolean;
  @ApiProperty() vaultAddr: string;
  @ApiProperty({ type: Number }) activeSecretsCount: number;
  @ApiProperty({ type: () => [SecretMetadataResponseDto] }) secrets: SecretMetadataResponseDto[];
  @ApiProperty({ type: () => [SecretAuditLogResponseDto] }) recentAuditLogs: SecretAuditLogResponseDto[];
}

export class RotateSecretResponseDto extends SecretMetadataResponseDto {}
