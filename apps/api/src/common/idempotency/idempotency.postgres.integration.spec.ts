import { IdempotencyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { runIdempotentTransaction } from './idempotency-transaction';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PostgreSQL idempotency concurrency', () => {
  const actor = {
    id: '20000000-0000-4000-8000-000000000001',
    orgId: '20000000-0000-4000-8000-000000000002',
    farmId: '20000000-0000-4000-8000-000000000003',
  };
  const context = {
    key: '20000000-0000-4000-8000-000000000004',
    requestHash: 'a'.repeat(64),
    method: 'POST',
    path: '/api/v1/integration/idempotency',
  };
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.onModuleDestroy();
  });

  it('serializes concurrent duplicates and commits exactly one business effect', async () => {
    let executions = 0;
    const operation = async (tx: any) => {
      executions += 1;
      await tx.auditEvent.create({
        data: {
          orgId: actor.orgId,
          farmId: actor.farmId,
          actorUserId: actor.id,
          action: 'integration.idempotency.effect',
          entityType: 'integration-test',
          httpMethod: context.method,
          path: context.path,
          statusCode: 201,
        },
      });
      await new Promise(resolve => setTimeout(resolve, 150));
      return { committed: true, ordinal: executions };
    };

    const [first, duplicate] = await Promise.all([
      runIdempotentTransaction(prisma, actor, context, operation),
      runIdempotentTransaction(prisma, actor, context, operation),
    ]);

    expect(first).toEqual({ committed: true, ordinal: 1 });
    expect(duplicate).toEqual(first);
    expect(executions).toBe(1);
    await expect(prisma.auditEvent.count({ where: { orgId: actor.orgId } })).resolves.toBe(1);
    await expect(prisma.idempotencyRecord.findUnique({
      where: { orgId_key: { orgId: actor.orgId, key: context.key } },
    })).resolves.toEqual(expect.objectContaining({
      status: IdempotencyStatus.COMPLETED,
      responseBody: first,
    }));
  });

  it('rolls back the key and the business effect together after failure', async () => {
    const failedContext = {
      ...context,
      key: '20000000-0000-4000-8000-000000000005',
      requestHash: 'b'.repeat(64),
      path: '/api/v1/integration/idempotency/rollback',
    };
    const failedAction = 'integration.idempotency.rolled-back-effect';

    await expect(runIdempotentTransaction(prisma, actor, failedContext, async tx => {
      await tx.auditEvent.create({
        data: {
          orgId: actor.orgId,
          actorUserId: actor.id,
          action: failedAction,
          entityType: 'integration-test',
          httpMethod: failedContext.method,
          path: failedContext.path,
          statusCode: 500,
        },
      });
      throw new Error('expected rollback');
    })).rejects.toThrow('expected rollback');

    await expect(prisma.idempotencyRecord.count({
      where: { orgId: actor.orgId, key: failedContext.key },
    })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({
      where: { orgId: actor.orgId, action: failedAction },
    })).resolves.toBe(0);

    await expect(runIdempotentTransaction(prisma, actor, failedContext, async () => ({ retried: true })))
      .resolves.toEqual({ retried: true });
  });
});
