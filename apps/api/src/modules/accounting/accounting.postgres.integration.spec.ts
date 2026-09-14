import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from './accounting.service';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Accounting financial-year regression scenarios', () => {
  let db: PrismaService;
  let service: AccountingService;
  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
    service = new AccountingService(db);
  });
  afterAll(async () => { if (db) await db.onModuleDestroy(); });

  async function fixture() {
    const org = await db.organization.create({ data: { name: 'Accounting regression' } });
    const farm = await db.farm.create({ data: { orgId: org.id, name: 'Isolated test farm' } });
    const year = await service.createFiscalYear({ yearName: '2030', startDate: '2030-01-01', endDate: '2030-12-31' }, farm.id);
    const accounts = await service.getChartOfAccounts(farm.id);
    const accountId = (code: string) => accounts.find(a => a.code === code)!.id;
    const post = (debit: string, credit: string, amount: number, yearId = year.id, date = '2030-01-10') =>
      service.createJournalEntry({ fiscalYearId: yearId, entryDate: date, description: 'Regression fixture', lines: [
        { accountId: accountId(debit), debit: amount, credit: 0 },
        { accountId: accountId(credit), debit: 0, credit: amount },
      ] }, farm.id);
    return { farm, year, post };
  }

  it('preserves historical operating profit after closing while keeping the balance sheet balanced', async () => {
    const { farm, year, post } = await fixture();
    await post('1101', '4101', 100);
    await post('5101', '1101', 40);
    expect((await service.getIncomeStatement(farm.id, year.id)).netProfit).toBe(60);
    await service.rolloverFiscalYear(year.id, '2031', farm.id);
    expect(await service.getIncomeStatement(farm.id, year.id)).toEqual(expect.objectContaining({
      totalRevenue: 100, totalExpenses: 40, netProfit: 60,
    }));
    expect((await service.getBalanceSheet(farm.id, year.id)).isBalanced).toBe(true);
  });

  it('does not include next-year transactions twice when rolling over the preceding year', async () => {
    const { farm, year, post } = await fixture();
    await post('1101', '3101', 100);
    const next = await service.createFiscalYear({ yearName: '2031', startDate: '2031-01-01', endDate: '2031-12-31' }, farm.id);
    await post('1101', '3101', 20, next.id, '2031-01-10');
    await service.rolloverFiscalYear(year.id, '2031', farm.id);
    const trial = await service.getTrialBalance(farm.id, next.id);
    expect(trial.accounts.find(a => a.code === '1101')!.netDebit).toBe(120);
    await expect(service.rolloverFiscalYear(year.id, '2031', farm.id)).rejects.toThrow();
  });
});
