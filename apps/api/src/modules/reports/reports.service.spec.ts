import { ReportsService } from './reports.service';

describe('ReportsService dashboard boundaries', () => {
  it('queries milk production with deterministic UTC day boundaries', async () => {
    const milkFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      animal: { count: jest.fn().mockResolvedValue(0) },
      milkLog: { findMany: milkFindMany },
      breedingRecord: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    const service = new ReportsService(prisma);
    const expectedDay = new Date().toISOString().split('T')[0];
    const start = new Date(`${expectedDay}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    await service.getExecutiveDashboard('farm-a');

    expect(milkFindMany).toHaveBeenCalledWith({
      where: {
        animal: { farmId: 'farm-a' },
        logDate: { gte: start, lt: end },
      },
    });
  });
});
