import { ReportsService } from './reports.service';

describe('ReportsService dashboard boundaries', () => {
  it('accepts configured decimal prices and reports posted revenue independently of production', async () => {
    const milkPrice = process.env.MILK_PRICE_PER_LITER;
    const beefPrice = process.env.BEEF_MARKET_PRICE_PER_KG;
    process.env.MILK_PRICE_PER_LITER = '3.5';
    process.env.BEEF_MARKET_PRICE_PER_KG = '20';
    try {
      const prisma = {
        milkLog: { findMany: jest.fn().mockResolvedValue([]) },
        feedDistribution: { findMany: jest.fn().mockResolvedValue([]) },
        healthTreatment: { findMany: jest.fn().mockResolvedValue([]) },
        weightLog: { findMany: jest.fn().mockResolvedValue([]) },
        journalEntryLine: { aggregate: jest.fn().mockResolvedValue({ _sum: { debit: null, credit: null } }) },
      } as any;
      const report = await new ReportsService(prisma).getFinancialOverview('farm-a');
      expect(report.milkEconomics.sellingPricePerLiter).toBe(3.5);
      expect(report.beefEconomics.marketPricePerKg).toBe(20);
      expect(report.farmPnL.netProfit).toBe(0);
    } finally {
      if (milkPrice === undefined) delete process.env.MILK_PRICE_PER_LITER;
      else process.env.MILK_PRICE_PER_LITER = milkPrice;
      if (beefPrice === undefined) delete process.env.BEEF_MARKET_PRICE_PER_KG;
      else process.env.BEEF_MARKET_PRICE_PER_KG = beefPrice;
    }
  });
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
