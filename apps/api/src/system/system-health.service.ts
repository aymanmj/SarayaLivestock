import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService, REQUIRED_DATABASE_MIGRATION } from '../database/prisma.service';

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness() {
    return {
      status: 'ok' as const,
      version: process.env.APP_VERSION || '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    try {
      await this.prisma.assertRequiredSchema();
      return {
        ...this.liveness(),
        status: 'ready' as const,
        database: 'connected' as const,
        requiredMigration: REQUIRED_DATABASE_MIGRATION,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'unavailable_or_incompatible',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
