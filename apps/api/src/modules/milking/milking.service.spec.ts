import { MilkingService } from './milking.service';

describe('MilkingService daily summaries', () => {
  it('uses deterministic UTC day boundaries', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new MilkingService({ milkLog: { findMany } } as any);

    const result = await service.getDailyFarmSummary('farm-a', '2026-08-28');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        logDate: {
          gte: new Date('2026-08-28T00:00:00.000Z'),
          lt: new Date('2026-08-29T00:00:00.000Z'),
        },
        animal: { farmId: 'farm-a' },
      },
    }));
    expect(result).toEqual(expect.objectContaining({
      date: '2026-08-28',
      totalLiters: 0,
      usableLiters: 0,
      discardedLiters: 0,
      cowsMilkedCount: 0,
      averagePerCow: '0',
      logs: [],
    }));
  });
});
