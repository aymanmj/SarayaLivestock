import { BadRequestException } from '@nestjs/common';
import { FiscalStatus, Gender, LifeStage, MilkingShift, Species, UserRole } from '@prisma/client';
import { HealthService } from '../../modules/health/health.service';
import { BreedingService } from '../../modules/breeding/breeding.service';
import { RationService } from '../../modules/nutrition/ration.service';
import { AccountingService } from '../../modules/accounting/accounting.service';
import { UsersService } from '../../modules/users/users.service';
import { AuthService } from '../../modules/auth/auth.service';
import { MilkingService } from '../../modules/milking/milking.service';

describe('Atomic domain workflows', () => {
  const actor = { id: 'user-a', orgId: 'org-a', farmId: 'farm-a' };

  it('writes treatment and withdrawal lock through one transaction', async () => {
    const tx = {
      healthTreatment: { create: jest.fn().mockResolvedValue({ id: 'treatment-a' }) },
      animal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'animal-a', withdrawalEndDate: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new HealthService(prisma);

    await service.recordTreatment({
      animalId: 'animal-a', diagnosis: 'اختبار', drugName: 'دواء', dosage: '10 ml',
      treatmentDate: '2026-08-27', milkWithdrawalDays: 5,
    }, 'farm-a', actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.healthTreatment.create).toHaveBeenCalledTimes(1);
    expect(tx.animal.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgId: 'org-a', actorUserId: 'user-a', action: 'health.treatment.recorded', entityId: 'treatment-a',
      }),
    }));
  });

  it('fails the treatment transaction when immutable audit evidence cannot be appended', async () => {
    const tx = {
      healthTreatment: { create: jest.fn().mockResolvedValue({ id: 'treatment-a' }) },
      animal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'animal-a', withdrawalEndDate: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: jest.fn().mockRejectedValue(new Error('audit unavailable')) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new HealthService(prisma);

    await expect(service.recordTreatment({
      animalId: 'animal-a', diagnosis: 'اختبار', drugName: 'دواء', dosage: '10 ml',
      treatmentDate: '2026-08-27', milkWithdrawalDays: 5,
    }, 'farm-a', actor)).rejects.toThrow('audit unavailable');
    expect(tx.healthTreatment.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('enforces the withdrawal lock and audits the discarded milk inside one transaction', async () => {
    const tx = {
      animal: { findFirst: jest.fn().mockResolvedValue({
        id: 'animal-a', withdrawalEndDate: new Date('2099-01-10'),
      }) },
      milkLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'milk-a', ...data })),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const service = new MilkingService(prisma);

    const result = await service.logMilk({
      animalId: 'animal-a', logDate: '2026-08-27', shift: MilkingShift.MORNING, yieldLiters: 18,
    }, 'farm-a', actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.milkLog.isDiscarded).toBe(true);
    expect(tx.milkLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ animalId: 'animal-a', isDiscarded: true }),
    }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'milking.yield.recorded', entityId: 'milk-a',
        metadata: { animalId: 'animal-a', shift: MilkingShift.MORNING, isDiscarded: true },
      }),
    }));
  });

  it('groups calving record, dam update and newborn creation in one transaction', async () => {
    const tx = {
      animal: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'newborn-a' }),
      },
      breedingRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'record-a', animalId: 'dam-a', inseminationDate: new Date('2025-12-01'), semenCode: 'S-1',
          animal: { id: 'dam-a', farmId: 'farm-a', barnId: null, species: Species.CATTLE, breed: 'Holstein' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new BreedingService(prisma);

    await service.recordCalving('record-a', {
      actualCalvingDate: '2026-08-27', offspringTagNumber: 'CALF-1', offspringGender: Gender.FEMALE,
    }, 'farm-a', actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.breedingRecord.update).toHaveBeenCalledTimes(1);
    expect(tx.animal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentLifeStage: LifeStage.LACTATING },
    }));
    expect(tx.animal.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'breeding.calving.recorded', entityId: 'record-a',
        metadata: { motherId: 'dam-a', newbornId: 'newborn-a' },
      }),
    }));
  });

  it('aborts feed distribution when the conditional stock decrement loses a race', async () => {
    const tx = {
      barn: { findFirst: jest.fn().mockResolvedValue({ id: 'barn-a', farmId: 'farm-a', name: 'A', sectorType: 'DAIRY' }) },
      feedFormula: { findFirst: jest.fn().mockResolvedValue({
        id: 'formula-a', name: 'TMR', items: [{ percentage: 100, ingredient: { id: 'ingredient-a', name: 'ذرة', currentStock: 100, costPerUnit: 1 } }],
      }) },
      feedIngredient: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      feedDistribution: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new RationService(prisma);

    await expect(service.dispenseFeedToBarn('barn-a', 'formula-a', 50, 'farm-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.feedDistribution.create).not.toHaveBeenCalled();
  });

  it('receives inventory stock and appends its tenant-scoped audit event in one transaction', async () => {
    const tx = {
      feedIngredient: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ingredient-a', farmId: 'farm-a' }),
        update: jest.fn().mockResolvedValue({ id: 'ingredient-a', currentStock: 140 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new RationService(prisma);

    await service.updateIngredientStock('ingredient-a', 40, 1.25, 'farm-a', actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.feedIngredient.update).toHaveBeenCalledWith({
      where: { id: 'ingredient-a' },
      data: { currentStock: { increment: 40 }, costPerUnit: 1.25 },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgId: 'org-a',
        farmId: 'farm-a',
        actorUserId: 'user-a',
        action: 'nutrition.stock.received',
        entityId: 'ingredient-a',
        metadata: { addedKg: 40, costChanged: true },
      }),
    }));
  });

  it('changes a user role and appends identity evidence in the same transaction', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-b', orgId: 'org-a', role: UserRole.WORKER, isActive: true,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'user-b', username: 'worker', fullName: 'Worker', role: UserRole.VETERINARIAN, isActive: true,
        }),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new UsersService(prisma);

    await service.updateRole('user-b', UserRole.VETERINARIAN, 'org-a', actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: { id: 'user-b', orgId: 'org-a' } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgId: 'org-a',
        actorUserId: 'user-a',
        action: 'identity.user.role-changed',
        entityId: 'user-b',
        metadata: {
          previousRole: UserRole.WORKER,
          newRole: UserRole.VETERINARIAN,
          sessionsRevoked: 2,
        },
      }),
    }));
  });

  it('creates a user and immutable audit evidence without copying the password', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({
          id: 'user-b', createdAt: new Date('2026-08-27'), ...data,
        })),
      },
      farm: { findFirst: jest.fn().mockResolvedValue({ id: 'farm-a' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const service = new AuthService(prisma, { sign: jest.fn() } as any);

    await service.register({
      username: 'new-worker',
      password: 'a-secure-password-2026',
      fullName: 'New Worker',
      role: UserRole.WORKER,
      farmId: 'farm-a',
    }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgId: 'org-a', farmId: 'farm-a', actorUserId: 'user-a',
        action: 'identity.user.created', entityId: 'user-b', metadata: { role: UserRole.WORKER },
      }),
    }));
    expect(JSON.stringify(tx.auditEvent.create.mock.calls[0][0])).not.toContain('a-secure-password-2026');
  });

  it('creates a fiscal year and all twelve periods in one transaction', async () => {
    const tx = {
      fiscalYear: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'year-a' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new AccountingService(prisma);

    await service.createFiscalYear({ yearName: '2027', startDate: '2027-01-01', endDate: '2027-12-31' }, 'farm-a');

    expect(tx.fiscalYear.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: FiscalStatus.OPEN,
        periods: { create: expect.arrayContaining([expect.objectContaining({ periodNumber: 1 })]) },
      }),
    }));
    expect(tx.fiscalYear.create.mock.calls[0][0].data.periods.create).toHaveLength(12);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({
      isolationLevel: 'Serializable',
    }));
  });

  it('allocates a deterministic journal number and posts balances atomically', async () => {
    const tx = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'year-a', yearName: '2027', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'),
        }),
      },
      account: {
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({}),
      },
      costCenter: { count: jest.fn() },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-a', startDate: new Date('2027-03-01'), endDate: new Date('2027-03-31'),
        }),
      },
      journalSequence: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'sequence-a', nextNumber: 2 }),
      },
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'entry-a', ...data })),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'year-a', yearName: '2027', status: FiscalStatus.OPEN,
          startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'),
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 'year-a', yearName: '2027', status: FiscalStatus.OPEN,
          startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'),
        }),
      },
      fiscalPeriod: {
        createMany: jest.fn().mockResolvedValue({ count: 12 }),
      },
      account: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      }
    } as any;
    const service = new AccountingService(prisma);

    const entry = await service.createJournalEntry({
      fiscalYearId: 'year-a',
      entryDate: '2027-03-10',
      description: 'قيد اختبار',
      lines: [
        { accountId: 'account-debit', debit: 125, credit: 0 },
        { accountId: 'account-credit', debit: 0, credit: 125 },
      ],
    }, 'farm-a', actor);

    expect(entry.entryNumber).toBe('JV-2027-000001');
    expect(tx.journalSequence.create).toHaveBeenCalledWith({
      data: { farmId: 'farm-a', fiscalYearId: 'year-a', nextNumber: 2 },
    });
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.journalEntry.create.mock.calls[0][0].data.fiscalPeriodId).toBe('period-a');
    expect(tx.account.update).toHaveBeenCalledTimes(2);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'accounting.journal.posted', entityId: 'entry-a' }),
    }));
  });

  it('builds year-scoped financial reports from database aggregates without a row cap', async () => {
    const prisma = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'year-a', yearName: '2027', status: FiscalStatus.OPEN,
          startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'),
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 'year-a', yearName: '2027', status: FiscalStatus.OPEN,
          startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'),
        }),
      },
      fiscalPeriod: {
        createMany: jest.fn().mockResolvedValue({ count: 12 }),
      },
      account: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'revenue-a', code: '4101', name: 'إيراد', category: 'REVENUE', children: [] },
          { id: 'expense-a', code: '5101', name: 'مصروف', category: 'EXPENSE', children: [] },
        ]),
      },
      journalEntryLine: {
        groupBy: jest.fn().mockResolvedValue([
          { accountId: 'revenue-a', _sum: { debit: 100, credit: 1000 } },
          { accountId: 'expense-a', _sum: { debit: 400, credit: 50 } },
        ]),
      },
    } as any;
    const service = new AccountingService(prisma);

    const statement = await service.getIncomeStatement('farm-a');

    expect(statement.period).toBe('السنة المالية 2027');
    expect(statement.totalRevenue).toBe(900);
    expect(statement.totalExpenses).toBe(350);
    expect(statement.netProfit).toBe(550);
    expect(prisma.journalEntryLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { journalEntry: { farmId: 'farm-a', fiscalYearId: 'year-a', status: 'POSTED' } },
    }));
  });

  it('refuses fiscal rollover when closing balances are not balanced', async () => {
    const tx = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-a', yearName: '2026' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'year-b', yearName: '2027', status: FiscalStatus.OPEN, ...data })),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'year-b', yearName: '2027', status: FiscalStatus.OPEN }),
      },
      fiscalPeriod: { updateMany: jest.fn().mockResolvedValue({ count: 12 }) },
      journalEntryLine: { groupBy: jest.fn().mockResolvedValue([]) },
      account: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'asset-a', category: 'ASSET', currentBalance: 100 }]),
      },
      journalEntry: { create: jest.fn() },
      journalSequence: { findUnique: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const service = new AccountingService(prisma);

    await expect(service.rolloverFiscalYear('year-a', '2027', 'farm-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
});
