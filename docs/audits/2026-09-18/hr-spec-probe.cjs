// Source-level probes with in-memory collaborators; no database or production writes.
const path = require('node:path');
const assert = require('node:assert/strict');
const api = path.resolve(__dirname, '../../../apps/api');
require(path.join(api, 'node_modules/ts-node')).register({ transpileOnly: true, project: path.join(api, 'tsconfig.json') });
const { PayrollService } = require(path.join(api, 'src/modules/hr/payroll.service.ts'));
async function main() {
  const advance = { amount: 1500, isSettled: false };
  const slips = [];
  const periods = [];
  const prisma = {
    fiscalPeriod: { findFirst: async () => ({ id: 'fiscal' }) },
    employee: { findMany: async () => [{ id: 'emp', baseSalary: 1000, advances: [advance] }] },
    payrollPeriod: { create: async ({data}) => { const p = { id: 'payroll', ...data }; periods.push(p); return p; } },
    employeeAdvance: { updateMany: async ({data}) => Object.assign(advance, data) },
    payrollSlip: { create: async ({data}) => { slips.push(data); return data; } },
  };
  const service = new PayrollService(prisma, {});
  await service.generatePayroll('farm', { startDate: '2026-01-01', endDate: '2026-01-31', monthName: 'Jan' }, {});
  assert.equal(slips[0].advancesSettled, 1000);
  assert.equal(advance.isSettled, true);
  const excess = { deducted: slips[0].advancesSettled, originalAdvance: advance.amount, remainingCollectibleViaUnsettledAdvances: advance.isSettled ? 0 : advance.amount, draftAlreadySettled: advance.isSettled };
  prisma.payrollSlip.create = async () => { throw new Error('simulated insert failure'); };
  advance.isSettled = false;
  await assert.rejects(service.generatePayroll('farm', { startDate: '2026-02-01', endDate: '2026-02-28', monthName: 'Feb' }, {}));
  assert.equal(periods.length, 2);
  assert.equal(advance.isSettled, true);
  let posted = 0;
  const payPrisma = {
    payrollPeriod: { findFirst: async () => ({ id: 'p', status: 'APPROVED', slips: [{netSalary: 1000}] }), update: async () => ({status:'PAID'}) },
    account: { findFirst: async () => ({id:'liability'}) },
  };
  const payService = new PayrollService(payPrisma, { createJournalEntry: async () => ({id: String(++posted)}) });
  await Promise.all([1,2].map(() => payService.payPayroll('farm', 'p', {paymentAccountId:'cash'}, {})));
  assert.equal(posted, 2);
  console.log(JSON.stringify({ excessAdvance: excess, failedGeneration: { orphanDrafts: periods.length - 1, advanceStillSettled: advance.isSettled }, concurrentPayment: { successfulRequests: 2, postedJournals: posted } }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
