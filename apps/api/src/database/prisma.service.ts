import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

export const REQUIRED_DATABASE_MIGRATION = '20260918120000_hr_advance_integrity';
function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured before starting the API');
  }
  return process.env.DATABASE_URL;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = getDatabaseUrl();
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX || 10),
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10_000),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30_000),
      application_name: 'saraya-api',
    });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      if (process.env.NODE_ENV === 'production') await this.assertRequiredSchema();
      this.logger.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    } catch (err: any) {
      this.logger.error('❌ تعذر الاتصال بقاعدة البيانات: ' + err.message);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }

  async assertRequiredSchema() {
    const tables = await this.$queryRaw<Array<{ migrations: string | null; sessions: string | null; idempotency: string | null }>>`
      SELECT to_regclass('public._prisma_migrations')::text AS migrations,
             to_regclass('public.user_sessions')::text AS sessions,
             to_regclass('public.idempotency_records')::text AS idempotency
    `;
    const schema = tables[0];
    if (!schema?.migrations || !schema.sessions || !schema.idempotency) {
      throw new Error('Database schema is not production-managed or required operational tables are missing');
    }
    const migrations = await this.$queryRaw<Array<{ applied: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = ${REQUIRED_DATABASE_MIGRATION}
          AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AS applied
    `;
    if (!migrations[0]?.applied) {
      throw new Error(`Required database migration is not applied: ${REQUIRED_DATABASE_MIGRATION}`);
    }
  }
}
