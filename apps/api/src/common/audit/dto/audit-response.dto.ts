import { ApiProperty } from '@nestjs/swagger';

export class AuditEventResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) orgId: string;
  @ApiProperty({ format: 'uuid', nullable: true }) farmId: string | null;
  @ApiProperty({ format: 'uuid' }) actorUserId: string;
  @ApiProperty() action: string;
  @ApiProperty() entityType: string;
  @ApiProperty({ nullable: true }) entityId: string | null;
  @ApiProperty() httpMethod: string;
  @ApiProperty() path: string;
  @ApiProperty({ type: Number }) statusCode: number;
  @ApiProperty({ nullable: true }) ipAddress: string | null;
  @ApiProperty({ nullable: true }) userAgent: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true }) metadata: unknown;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AuditEventPageResponseDto {
  @ApiProperty({ type: () => [AuditEventResponseDto] }) items: AuditEventResponseDto[];
  @ApiProperty({ format: 'uuid', nullable: true }) nextCursor: string | null;
}
