// Review only: writes fixtures exclusively to a new random disposable database.
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const api = path.resolve(__dirname, '../../../apps/api');
const req = createRequire(path.join(api, 'package.json'));
req('dotenv').config({ path: path.join(api, '.env') });
const source = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const name = 'saraya_audit_sales_' + randomBytes(8).toString('hex');
if (!/^saraya_audit_sales_[a-f0-9]{16}$/.test(name)) throw new Error('Unsafe target');
const target = new URL(source); target.pathname = '/' + name;
const admin = new (req('pg').Client)({ connectionString: source });
let created = false;
let db;
async function main() {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"'); created = true;
  process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'test';
  const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: api, env: process.env, stdio: 'inherit', shell: false });
  if (migrate.error || migrate.status !== 0) throw new Error('Migration child failed');
  const { PrismaService } = req('./dist/database/prisma.service');
  const { AccountingService } = req('./dist/modules/accounting/accounting.service');
  const { SalesService } = req('./dist/modules/sales/sales.service');
  db = new PrismaService(); await db.$connect();
  const org = await db.organization.create({ data: { name: 'Disposable sales review' } });
  const farm = await db.farm.create({ data: { orgId: org.id, name: 'Disposable' } });
  const accounting = new AccountingService(db);
  const year = await accounting.createFiscalYear({ yearName: '2030', startDate: '2030-01-01', endDate: '2030-12-31' }, farm.id);
  const accounts = await accounting.getChartOfAccounts(farm.id);
  const id = code => accounts.find(a => a.code === code).id;
  const sales = new SalesService(db);
  try {
    await sales.recordMilkSale({ liters: 100, pricePerLiter: 3.5, paymentMethod: 'CASH', buyerName: 'Fixture', saleDate: '2030-09-10' }, farm.id);
    console.log(JSON.stringify({ probe: 'sale-in-september-with-all-periods-open', result: 'accepted' }));
  } catch (e) {
    console.log(JSON.stringify({ probe: 'sale-in-september-with-all-periods-open', result: 'rejected', code: e.code, cause: e.meta?.driverAdapterError?.cause?.originalMessage || 'database error; all monthly periods are open' }));
  }
  const animal = await db.animal.create({ data: { farmId: farm.id, tagNumber: 'REVIEW-ANIMAL', purchasePrice: 1000, purpose: 'BEEF' } });
  await accounting.createJournalEntry({ fiscalYearId: year.id, entryDate: '2030-01-01', description: 'Animal opening asset', lines: [
    { accountId: id('1202'), animalId: animal.id, debit: 1000, credit: 0 },
    { accountId: id('3101'), debit: 0, credit: 1000 },
  ] }, farm.id);
  await sales.recordAnimalSale({ animalId: animal.id, pricingMethod: 'PER_HEAD', pricePerHead: 1200, paymentMethod: 'CASH', buyerName: 'Fixture', saleDate: '2030-01-10' }, farm.id);
  const trial = await accounting.getTrialBalance(farm.id, year.id);
  const income = await accounting.getIncomeStatement(farm.id, year.id);
  console.log(JSON.stringify({ probe: 'sale-of-capitalized-animal', expectedRemainingAnimalAsset: 0, actualRemainingAnimalAsset: trial.accounts.find(a => a.code === '1202').netDebit, expectedProfit: 200, actualProfit: income.netProfit }));
}
main().catch(e => { console.error('Review probe failed:', e.code || e.message); process.exitCode = 1; }).finally(async () => {
  if (db) await db.onModuleDestroy();
  if (created) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
    await admin.query('DROP DATABASE "' + name + '"');
    console.log('Disposable review database removed');
  }
  await admin.end();
});
