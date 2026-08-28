import { ConflictException, PayloadTooLargeException } from '@nestjs/common';
import { IdempotencyRecord, IdempotencyStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditActor } from '../audit/domain-audit';
import { IdempotencyContext } from './idempotency-context';

type TransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxRetries?: number;
  timeoutMs?: number;
};

const MAX_CACHED_RESPONSE_BYTES = 256 * 1024;

export async function runIdempotentTransaction<T>(
  prisma: PrismaService,
  actor: AuditActor | undefined,
  context: IdempotencyContext | undefined,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(async tx => {
        if (!actor || !context) return operation(tx);

        const recordId = randomUUID();
        const executionToken = randomUUID();
        const expiresAt = new Date(Date.now() + retentionMs());
        const inserted = await tx.$queryRaw<IdempotencyRecord[]>(Prisma.sql`
          INSERT INTO "idempotency_records" (
            "id", "orgId", "farmId", "actorUserId", "key", "requestHash",
            "method", "path", "executionToken", "expiresAt", "updatedAt"
          ) VALUES (
            ${recordId}, ${actor.orgId}, ${actor.farmId ?? null}, ${actor.id}, ${context.key},
            ${context.requestHash}, ${context.method}, ${context.path}, ${executionToken}, ${expiresAt}, NOW()
          )
          ON CONFLICT ("orgId", "key") DO NOTHING
          RETURNING *
        `);
        const ownsExecution = inserted.length === 1;
        const record = inserted[0] ?? (await tx.$queryRaw<IdempotencyRecord[]>(Prisma.sql`
          SELECT * FROM "idempotency_records"
          WHERE "orgId" = ${actor.orgId} AND "key" = ${context.key}
          FOR UPDATE
        `))[0];

        if (!record) throw new ConflictException('تعذر حجز مفتاح منع التكرار');

        if (
          record.actorUserId !== actor.id ||
          (record.farmId ?? null) !== (actor.farmId ?? null) ||
          record.requestHash !== context.requestHash ||
          record.method !== context.method ||
          record.path !== context.path
        ) {
          throw new ConflictException('تم استخدام Idempotency-Key نفسه لطلب مختلف');
        }
        if (record.status === IdempotencyStatus.COMPLETED) {
          return record.responseBody as T;
        }
        if (!ownsExecution) {
          throw new ConflictException('يوجد طلب مطابق قيد التنفيذ بالفعل');
        }

        const result = await operation(tx);
        const responseBody = toJson(result);
        const responseBytes = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
        if (responseBytes > MAX_CACHED_RESPONSE_BYTES) {
          throw new PayloadTooLargeException('استجابة العملية أكبر من حد التخزين الآمن لمنع التكرار');
        }
        await tx.idempotencyRecord.update({
          where: { id: record.id },
          data: { status: IdempotencyStatus.COMPLETED, responseBody },
        });
        return result;
      }, {
        isolationLevel: options.isolationLevel,
        maxWait: 5_000,
        timeout: options.timeoutMs ?? 30_000,
      });
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableTransactionError(error)) throw error;
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function retentionMs() {
  const configured = Number(process.env.IDEMPOTENCY_RETENTION_DAYS || 7);
  const days = Number.isInteger(configured) && configured >= 1 && configured <= 30 ? configured : 7;
  return days * 24 * 60 * 60 * 1000;
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2034' || error.code === 'P2002');
}
