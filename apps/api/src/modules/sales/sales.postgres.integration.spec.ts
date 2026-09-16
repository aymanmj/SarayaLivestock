import { PrismaService } from '../../database/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { SalesService } from './sales.service';
import { AnimalsService } from '../animals/animals.service';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
describeDatabase('Commercial posting safety', () => {
  let db: PrismaService;
  beforeAll(async () => { db = new PrismaService(); await db.$connect(); });
  afterAll(async () => { if (db) await db.onModuleDestroy(); });
  async function fixture() {
    const org = await db.organization.create({ data: { name: 'Posting regression' } });
    const farm = await db.farm.create({ data: { orgId: org.id, name: 'Isolated' } });
    const accounting = new AccountingService(db);
    const year = await accounting.createFiscalYear({ yearName: '2030', startDate: '2030-01-01', endDate: '2030-12-31' }, farm.id);
    const accounts = await accounting.getChartOfAccounts(farm.id);
    const account = (code: string) => accounts.find(a => a.code === code)!.id;
    const animal = await db.animal.create({ data: { farmId: farm.id, tagNumber: 'ASSET', purpose: 'BEEF', purchasePrice: 9999 } });
    const sales = new SalesService(db);
    return { farm, year, accounting, account, animal, sales };
  }
  it('posts September sales to September and derecognizes the ledger value rather than purchase price', async () => {
    const { farm, year, accounting, account, animal, sales } = await fixture();
    await accounting.createJournalEntry({ fiscalYearId: year.id, entryDate: '2030-01-01', description: 'Recognized animal asset', lines: [
      { accountId: account('1202'), animalId: animal.id, debit: 1000, credit: 0 },
      { accountId: account('3101'), debit: 0, credit: 1000 },
    ] }, farm.id);
    const sale = await sales.recordAnimalSale({ animalId: animal.id, pricingMethod: 'PER_HEAD', pricePerHead: 1200, paymentMethod: 'CASH', buyerName: 'Fixture', saleDate: '2030-09-10' }, farm.id);
    const entries = await accounting.getJournalEntries(farm.id);
    expect(entries.find(entry => entry.id === sale.journalEntryId)!.entryDate.toISOString()).toContain('2030-09-10');
    const trial = await accounting.getTrialBalance(farm.id, year.id);
    expect(Number(trial.accounts.find(a => a.code === '1202')!.netDebit)).toBe(0);
    expect(Number((await accounting.getIncomeStatement(farm.id, year.id)).netProfit)).toBe(200);
    await expect(new AnimalsService(db).updateStatus(animal.id, 'ACTIVE', farm.id)).rejects.toThrow();
  });
  it('does not invent a mortality book value when no animal asset has been recognized', async () => {
    const { farm, animal, sales } = await fixture();
    await expect(sales.recordAnimalMortality({ animalId: animal.id, deathDate: '2030-09-10', causeOfDeath: 'Test' }, farm.id)).rejects.toThrow('القيمة الدفترية');
    expect((await new AnimalsService(db).findOne(animal.id, farm.id)).status).toBe('ACTIVE');
  });
  it('posts mortality using the recorded asset even if its current purpose differs', async () => {
    const { farm, year, accounting, account, animal, sales } = await fixture();
    await accounting.createJournalEntry({ fiscalYearId: year.id, entryDate: '2030-01-01', description: 'Calf asset', lines: [
      { accountId: account('1203'), animalId: animal.id, debit: 1000, credit: 0 },
      { accountId: account('3101'), debit: 0, credit: 1000 },
    ] }, farm.id);
    const mortality = await sales.recordAnimalMortality({ animalId: animal.id, deathDate: '2030-09-10', causeOfDeath: 'Test', salvageValue: 100 }, farm.id);
    expect(mortality.netLoss).toBe('900.000');
    const trial = await accounting.getTrialBalance(farm.id, year.id);
    expect(Number(trial.accounts.find(a => a.code === '1203')!.netDebit)).toBe(0);
    expect(Number((await accounting.getIncomeStatement(farm.id, year.id)).netProfit)).toBe(-900);
  });
});
