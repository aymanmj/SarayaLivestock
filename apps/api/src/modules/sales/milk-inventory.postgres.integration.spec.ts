import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { SalesService } from './sales.service';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
describeDatabase('Milk inventory and policy boundaries on PostgreSQL', () => {
  let db: PrismaService;
  beforeAll(async () => { db = new PrismaService(); await db.$connect(); });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => { await db.onModuleDestroy(); });
  async function fixture(carry = false) {
    const org = await db.organization.create({ data: { name: 'Milk release verification' } });
    const farm = await db.farm.create({ data: { orgId: org.id, name: 'Isolated', milkPolicy: carry ? 'CARRY_OVER' : 'DAILY_RESET' } });
    const accounting = new AccountingService(db);
    await accounting.createFiscalYear({ yearName: '2030', startDate: '2030-01-01', endDate: '2030-12-31' }, farm.id);
    await accounting.getChartOfAccounts(farm.id);
    const animal = await db.animal.create({ data: { farmId: farm.id, tagNumber: 'MILK', gender: 'FEMALE', currentLifeStage: 'LACTATING' } });
    const sales = new SalesService(db);
    return {
      farm, sales,
      produce: (day: string, liters: number) => db.milkLog.create({ data: { animalId: animal.id, logDate: new Date(day), shift: 'MORNING', yieldLiters: liters } }),
      sell: (day: string, liters: number) => sales.recordMilkSale({ saleDate: day, liters, pricePerLiter: 1, buyerName: 'Test', paymentMethod: 'CASH' }, farm.id),
    };
  }
  it('changes policy from today without resurrecting expired production or moving the boundary on retry', async () => {
    const f = await fixture();
    await f.produce('2030-09-01', 100);
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2030-09-02T12:00:00Z').getTime());
    expect(await f.sales.updateMilkPolicy(f.farm.id, 'CARRY_OVER')).toEqual({ milkPolicy: 'CARRY_OVER', effectiveDate: '2030-09-02' });
    await expect(f.sell('2030-09-02', 1)).rejects.toThrow('مخزون');
    await expect(f.sell('2030-09-01', 1)).rejects.toThrow('يسبق');
    await f.produce('2030-09-02', 20);
    expect((await f.sell('2030-09-03', 20)).liters).toBe('20.000');
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2030-09-04T12:00:00Z').getTime());
    expect((await f.sales.updateMilkPolicy(f.farm.id, 'CARRY_OVER')).effectiveDate).toBe('2030-09-02');
  });
  it('refuses policy changes after a sale on the effective day', async () => {
    const f = await fixture(true);
    await f.produce('2030-09-01', 100);
    await f.sell('2030-09-02', 50);
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2030-09-02T12:00:00Z').getTime());
    await expect(f.sales.updateMilkPolicy(f.farm.id, 'DAILY_RESET')).rejects.toThrow('مبيعات');
    expect((await f.sales.getMilkPolicy(f.farm.id)).milkPolicy).toBe('CARRY_OVER');
  });
  it('rejects backdated depletion even when later production restores the lifetime balance', async () => {
    const f = await fixture(true);
    await f.produce('2030-09-01', 100);
    await f.sell('2030-09-02', 100);
    await f.produce('2030-09-03', 100);
    await expect(f.sell('2030-09-01', 1)).rejects.toThrow('عجز');
    expect(await db.commercialSale.count({ where: { farmId: f.farm.id } })).toBe(1);
  });
  it('prevents real concurrent sales from spending the same milk twice', async () => {
    const f = await fixture(true);
    await f.produce('2030-09-01', 100);
    const results = await Promise.allSettled([f.sell('2030-09-01', 70), f.sell('2030-09-01', 70)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const total = await db.commercialSale.aggregate({ where: { farmId: f.farm.id }, _sum: { liters: true } });
    expect(Number(total._sum.liters)).toBe(70);
  });
  it('deducts recorded calf feeding and waste before selling', async () => {
    const f = await fixture(true);
    await f.produce('2030-09-01', 100);
    await db.bulkTankLog.create({ data: { farmId: f.farm.id, logDate: new Date('2030-09-01'), totalYieldLiters: 100, soldLiters: 0, calfFeedingLiters: 20, wastedLiters: 10 } });
    await expect(f.sell('2030-09-01', 71)).rejects.toThrow('مخزون');
    expect((await f.sell('2030-09-01', 70)).liters).toBe('70.000');
  });
});
