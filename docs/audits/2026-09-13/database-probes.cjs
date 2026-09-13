// Audit only: creates and removes a uniquely named disposable database.
// Never runs migrations or business writes against the configured source database.
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const apiDir = path.resolve(__dirname, '../../../apps/api');
const req = createRequire(path.join(apiDir, 'package.json'));
req('dotenv').config({ path: path.join(apiDir, '.env') });
const { Client } = req('pg');
const source = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!source) throw new Error('Database configuration unavailable');
const name = 'saraya_audit_20260913_' + randomBytes(8).toString('hex');
if (!/^saraya_audit_20260913_[a-f0-9]{16}$/.test(name)) throw new Error('Unsafe target');
const target = new URL(source);
target.pathname = '/' + name;
target.searchParams.set('schema', 'public');
const admin = new Client({ connectionString: source, connectionTimeoutMillis: 5000 });
let created = false;
let prisma;
function run(args) {
  const r = spawnSync(process.execPath, args, { cwd: apiDir, env: process.env, stdio: 'inherit', shell: false });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('Verification child failed with status ' + r.status);
}
async function main() {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"');
  created = true;
  console.log('Created disposable audit database: ' + name);
  process.env.DATABASE_URL = target.toString();
  process.env.NODE_ENV = 'test';
  process.env.RUN_DB_INTEGRATION_TESTS = 'true';
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', 'src/database/migrations.integration.spec.ts', 'src/common/idempotency/idempotency.postgres.integration.spec.ts']);
  const { PrismaService } = req('./dist/database/prisma.service.js');
  const { AccountingService } = req('./dist/modules/accounting/accounting.service.js');
  const { MilkingService } = req('./dist/modules/milking/milking.service.js');
  const { BreedingService } = req('./dist/modules/breeding/breeding.service.js');
  prisma = new PrismaService();
  await prisma.$connect();
  const org = await prisma.organization.create({ data: { name: 'Disposable audit fixtures' } });
  const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'Audit only' } });
  const accounting = new AccountingService(prisma);
  const accounts = await accounting.getChartOfAccounts(farm.id);
  const id = code => accounts.find(a => a.code === code).id;
  const year = (await accounting.getFiscalYears(farm.id))[0];
  const y = Number(year.yearName);
  const post = (debitCode, creditCode, amount, fiscalYearId, date) => accounting.createJournalEntry({
    fiscalYearId, entryDate: date, description: 'Disposable audit fixture',
    lines: [{ accountId: id(debitCode), debit: amount, credit: 0 }, { accountId: id(creditCode), debit: 0, credit: amount }],
  }, farm.id);
  await post('1101', '4101', 100, year.id, `${y}-01-10`);
  await post('5101', '1101', 40, year.id, `${y}-01-11`);
  const before = await accounting.getIncomeStatement(farm.id, year.id);
  await accounting.rolloverFiscalYear(year.id, String(y + 1), farm.id);
  const after = await accounting.getIncomeStatement(farm.id, year.id);
  console.log(JSON.stringify({ probe: 'historical-income-after-close', before: { revenue: before.totalRevenue, expense: before.totalExpenses, profit: before.netProfit }, after: { revenue: after.totalRevenue, expense: after.totalExpenses, profit: after.netProfit } }));
  const next = (await accounting.getFiscalYears(farm.id)).find(f => f.yearName === String(y + 1));
  await post('1101', '3101', 100, next.id, `${y + 1}-01-10`);
  const next2 = await accounting.createFiscalYear({ yearName: String(y + 2), startDate: `${y + 2}-01-01`, endDate: `${y + 2}-12-31` }, farm.id);
  await post('1101', '3101', 20, next2.id, `${y + 2}-01-10`);
  await accounting.rolloverFiscalYear(next.id, String(y + 2), farm.id);
  const tb = await accounting.getTrialBalance(farm.id, next2.id);
  const cash = tb.accounts.find(a => a.code === '1101');
  console.log(JSON.stringify({ probe: 'rollover-to-year-with-existing-postings', expectedCash: 180, actualCash: cash.netDebit, explanation: '60 prior opening + 100 current capital + 20 next-year capital; next-year activity must not enter opening twice' }));
  const cow = await prisma.animal.create({ data: { farmId: farm.id, tagNumber: 'AUDIT-DAM', gender: 'FEMALE', currentLifeStage: 'LACTATING', withdrawalEndDate: new Date('2026-09-01T00:00:00Z') } });
  const milk = await new MilkingService(prisma).logMilk({ animalId: cow.id, logDate: '2026-08-31', shift: 'MORNING', yieldLiters: 10 }, farm.id);
  console.log(JSON.stringify({ probe: 'backdated-withdrawn-milk', expectedDiscarded: true, actualDiscarded: milk.milkLog.isDiscarded }));
  const breeding = await prisma.breedingRecord.create({ data: { animalId: cow.id, inseminationDate: new Date('2025-12-01'), actualCalvingDate: new Date('2026-09-01'), pdResult: 'PREGNANT' } });
  const birth = await new BreedingService(prisma).recordCalving(breeding.id, { actualCalvingDate: '2026-09-10', offspringTagNumber: 'AUDIT-SECOND', offspringGender: 'FEMALE' }, farm.id);
  console.log(JSON.stringify({ probe: 'repeat-completed-calving', expected: 'rejected', actual: birth.newborn ? 'newborn-created' : 'other' }));
}
main().catch(e => { console.error('Audit failed:', e.code || e.message); process.exitCode = 1; }).finally(async () => {
  if (prisma) await prisma.onModuleDestroy();
  if (created) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
    await admin.query('DROP DATABASE "' + name + '"');
    console.log('Removed disposable audit database: ' + name);
  }
  await admin.end();
});
