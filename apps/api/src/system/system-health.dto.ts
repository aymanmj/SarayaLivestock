import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'ready'] }) status: 'ok' | 'ready';
  @ApiProperty({ example: '1.0.0' }) version: string;
  @ApiProperty({ example: 123 }) uptimeSeconds: number;
  @ApiProperty({ example: '2026-08-28T12:00:00.000Z' }) timestamp: string;
}

export class ReadinessResponseDto extends LivenessResponseDto {
  @ApiProperty({ example: 'ready' }) declare status: 'ready';
  @ApiProperty({ example: 'connected' }) database: 'connected';
  @ApiProperty({ example: '0005_operational_idempotency' }) requiredMigration: string;
}
