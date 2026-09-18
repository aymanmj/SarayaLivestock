import { FiscalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from './accounting.service';

describe('AccountingService production initialization', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoSeed = process.env.ALLOW_DEMO_SEED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ALLOW_DEMO_SEED = originalDemoSeed;
    jest.restoreAllMocks();
  });

  it('creates an idempotent zero-balance accounting structure for every production farm', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_SEED;

    const fiscalYear = {
      id: 'year-1',
      farmId: 'farm-1',
      yearName: '2026',
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: new Date(Date.UTC(2026, 11, 31)),
      status: FiscalStatus.OPEN,
      isCurrent: true,
    };
    const prisma = {
      farm: { findMany: jest.fn().mockResolvedValue([{ id: 'farm-1' }]) },
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(fiscalYear),
      },
      fiscalPeriod: { createMany: jest.fn().mockResolvedValue({ count: 12 }) },
      account: { createMany: jest.fn().mockResolvedValue({ count: 24 }) },
    } as unknown as PrismaService;

    const service = new AccountingService(prisma);
    await service.onModuleInit();

    expect((prisma as any).fiscalYear.upsert).toHaveBeenCalledTimes(1);
    const periods = (prisma as any).fiscalPeriod.createMany.mock.calls[0][0];
    expect(periods.skipDuplicates).toBe(true);
    expect(periods.data).toHaveLength(12);

    const accounts = (prisma as any).account.createMany.mock.calls[0][0];
    expect(accounts.skipDuplicates).toBe(true);
    expect(accounts.data).toHaveLength(24);
    expect(accounts.data.some((a: { code: string }) => a.code === '1106')).toBe(true);
    expect(accounts.data.every((account: { currentBalance: number }) => account.currentBalance === 0)).toBe(true);
  });

  it('coalesces simultaneous initialization requests for the same farm', async () => {
    const fiscalYear = {
      id: 'year-1',
      startDate: new Date(Date.UTC(2026, 0, 1)),
    };
    const prisma = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue(fiscalYear),
      },
      fiscalPeriod: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      account: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as PrismaService;
    const service = new AccountingService(prisma);

    await Promise.all(Array.from({ length: 6 }, () =>
      (service as any).ensureAccountingStructure('farm-1')));

    expect((prisma as any).fiscalYear.findFirst).toHaveBeenCalledTimes(1);
    expect((prisma as any).fiscalPeriod.createMany).toHaveBeenCalledTimes(1);
    expect((prisma as any).account.createMany).toHaveBeenCalledTimes(1);
  });
});
