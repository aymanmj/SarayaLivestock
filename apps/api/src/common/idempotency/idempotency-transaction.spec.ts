import { ConflictException } from '@nestjs/common';
import { IdempotencyStatus } from '@prisma/client';
import { runIdempotentTransaction } from './idempotency-transaction';

describe('Idempotent transaction', () => {
  const actor = { id: 'user-a', orgId: 'org-a', farmId: 'farm-a' };
  const context = {
    key: '2f1d5b44-23cf-4f04-8cbe-885dc1cf26ab',
    requestHash: 'a'.repeat(64),
    method: 'POST',
    path: '/api/v1/animals',
  };

  function processingRecord() {
    return {
      id: 'idempotency-a',
      orgId: actor.orgId,
      farmId: actor.farmId,
      actorUserId: actor.id,
      ...context,
      executionToken: 'execution-a',
      status: IdempotencyStatus.PROCESSING,
      responseBody: null,
    };
  }

  it('executes once and commits the cached response in the same transaction', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([processingRecord()]),
      idempotencyRecord: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const operation = jest.fn().mockResolvedValue({ id: 'animal-a', created: true });

    await expect(runIdempotentTransaction(prisma, actor, context, operation))
      .resolves.toEqual({ id: 'animal-a', created: true });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith({
      where: { id: 'idempotency-a' },
      data: { status: IdempotencyStatus.COMPLETED, responseBody: { id: 'animal-a', created: true } },
    });
  });

  it('replays a completed response without executing the operation again', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'idempotency-a', orgId: actor.orgId, farmId: actor.farmId, actorUserId: actor.id,
          ...context, status: IdempotencyStatus.COMPLETED, executionToken: 'previous',
          responseBody: { id: 'animal-a', replayed: true },
        }]),
      idempotencyRecord: {
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const operation = jest.fn();

    await expect(runIdempotentTransaction(prisma, actor, context, operation))
      .resolves.toEqual({ id: 'animal-a', replayed: true });
    expect(operation).not.toHaveBeenCalled();
    expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });

  it('rejects reuse by another request, actor, or farm', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'idempotency-a', orgId: actor.orgId, farmId: 'farm-b', actorUserId: actor.id,
          ...context, requestHash: 'b'.repeat(64), status: IdempotencyStatus.COMPLETED,
          executionToken: 'previous', responseBody: {},
        }]),
      idempotencyRecord: {
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const operation = jest.fn();

    await expect(runIdempotentTransaction(prisma, actor, context, operation)).rejects.toBeInstanceOf(ConflictException);
    expect(operation).not.toHaveBeenCalled();
  });

  it('does not mark the key completed when the business operation fails', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([processingRecord()]),
      idempotencyRecord: {
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const operation = jest.fn().mockRejectedValue(new Error('business failure'));

    await expect(runIdempotentTransaction(prisma, actor, context, operation)).rejects.toThrow('business failure');
    expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });
});
