// Reads live TypeScript source, never creates a database client or connection.
// Run from any directory: node docs/audits/2026-09-15/review-current-stock-cost.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const api = path.resolve(__dirname, '../../../apps/api');
require(path.join(api, 'node_modules/ts-node')).register({ transpileOnly: true, project: path.join(api, 'tsconfig.json') });
const { RationService } = require(path.join(api, 'src/modules/nutrition/ration.service.ts'));
const { SalesService } = require(path.join(api, 'src/modules/sales/sales.service.ts'));

async function main() {
  const ingredients = [7, 36, 81].map((proteinPct, i) => ({ id: String(i), name: String(i), proteinPct, costPerKg: [1, 5, 42][i], energyMcal: 1 }));
  const result = new RationService({}).calculateLeastCostRation(ingredients, { targetProteinPct: 41.09, batchTotalKg: 1000 });
  const alternative = [0.01, 88.67, 11.32];
  const alternativeProtein = alternative.reduce((sum, x, i) => sum + x * ingredients[i].proteinPct / 100, 0);
  const alternativeCost = alternative.reduce((sum, x, i) => sum + x * 10 * ingredients[i].costPerKg, 0);
  assert.equal(alternative.reduce((sum, x) => sum + Math.round(x * 100), 0), 10000);
  assert.ok(alternativeProtein >= 41.09);
  assert.ok(result.totalCost > alternativeCost);

  const productions = [{ logDate: new Date('2030-09-01'), yieldLiters: 100, farmId: 'farm', isDiscarded: false }];
  const sales = [];
  const inDate = (date, filter) => filter instanceof Date ? +date === +filter : !filter || (!filter.lte || date <= filter.lte);
  const tx = {
    farm: { findUnique: async () => ({ milkPolicy: 'CARRY_OVER' }) },
    fiscalYear: { findMany: async () => [{ id: 'year', yearName: '2030', periods: [{ id: 'period' }] }] },
    milkLog: { aggregate: async ({ where }) => ({ _sum: { yieldLiters: productions.filter(p => p.farmId === where.animal.farmId && p.isDiscarded === where.isDiscarded && inDate(p.logDate, where.logDate)).reduce((sum, p) => sum + p.yieldLiters, 0) } }) },
    commercialSale: {
      aggregate: async ({ where }) => ({ _sum: { liters: sales.filter(s => s.farmId === where.farmId && s.saleType === where.saleType && inDate(s.saleDate, where.saleDate)).reduce((sum, s) => sum + s.liters, 0) } }),
      count: async () => sales.length,
      create: async ({ data }) => { const row = { id: `sale-${sales.length}`, ...data, createdAt: new Date(), updatedAt: new Date() }; sales.push(row); return row; },
    },
    bulkTankLog: { aggregate: async () => ({ _sum: { calfFeedingLiters: 0, wastedLiters: 0 } }) },
    account: { findUnique: async ({ where }) => ({ id: where.farmId_code.code }), update: async () => ({}) },
    costCenter: { findFirst: async () => null },
    journalSequence: { upsert: async () => ({ nextNumber: sales.length + 2 }) },
    journalEntry: { create: async () => ({ id: `journal-${sales.length}` }) },
  };
  const service = new SalesService({ $transaction: async callback => callback(tx) });
  const dto = { liters: 100, pricePerLiter: 1, paymentMethod: 'CASH', buyerName: 'Review' };
  await service.recordMilkSale({ ...dto, saleDate: '2030-09-02' }, 'farm');
  await service.recordMilkSale({ ...dto, saleDate: '2030-09-01' }, 'farm');
  const remaining = 100 - sales.reduce((sum, s) => sum + s.liters, 0);
  assert.equal(sales.length, 2);
  assert.equal(remaining, -100);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: 'live TypeScript', ration: { returned: result.items.map(i => ({ id: i.ingredientId, percentage: i.percentage })), cost: result.totalCost, alternative, alternativeProtein, alternativeCost }, carryOver: { productionLiters: 100, acceptedSales: sales.map(s => ({ date: s.saleDate.toISOString(), liters: s.liters })), finalBalance: remaining } }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
