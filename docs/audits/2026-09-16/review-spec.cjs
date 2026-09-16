// Source-only review probes; no database connection or product mutation.
const path = require('node:path');
const assert = require('node:assert/strict');
const api = path.resolve(__dirname, '../../../apps/api');
require(path.join(api, 'node_modules/ts-node')).register({ transpileOnly: true, project: path.join(api, 'tsconfig.json') });
const { RationService } = require(path.join(api, 'src/modules/nutrition/ration.service.ts'));
const { SalesService } = require(path.join(api, 'src/modules/sales/sales.service.ts'));
async function main() {
  const ingredients = [89, 78, 42].map((proteinPct, i) => ({ id: String(i), name: String(i), proteinPct, costPerKg: [96, 82, 48][i], energyMcal: 1 }));
  const result = new RationService({}).calculateLeastCostRation(ingredients, { targetProteinPct: 65.51, batchTotalKg: 1000 });
  const alternative = [0.02, 65.28, 34.70];
  const alternativeProtein = alternative.reduce((s, v, i) => s + v * ingredients[i].proteinPct / 100, 0);
  const alternativeCost = alternative.reduce((s, v, i) => s + v * 10 * ingredients[i].costPerKg, 0);
  assert.equal(alternative.reduce((s, v) => s + Math.round(v * 100), 0), 10000);
  assert.ok(alternativeProtein >= 65.51);
  assert.ok(result.totalCost > alternativeCost + 0.001);
  let policy = 'DAILY_RESET';
  const productions = [{ logDate: new Date('2030-09-01'), yieldLiters: 100, farmId: 'farm', isDiscarded: false }];
  const sales = [];
  const inDate = (d, f) => f instanceof Date ? +d === +f : !f || ((!f.lte || d <= f.lte) && (!f.gt || d > f.gt));
  const tx = {
    farm: { findUnique: async () => ({ milkPolicy: policy }), update: async ({ data }) => ({ milkPolicy: policy = data.milkPolicy }) },
    fiscalYear: { findMany: async () => [{ id: 'year', yearName: '2030', periods: [{ id: 'period' }] }] },
    milkLog: {
      aggregate: async ({ where }) => ({ _sum: { yieldLiters: productions.filter(p => p.farmId === where.animal.farmId && p.isDiscarded === where.isDiscarded && inDate(p.logDate, where.logDate)).reduce((s, p) => s + p.yieldLiters, 0) } }),
      findMany: async ({ where }) => productions.filter(p => inDate(p.logDate, where.logDate)),
    },
    commercialSale: {
      aggregate: async ({ where }) => ({ _sum: { liters: sales.filter(s => s.farmId === where.farmId && s.saleType === where.saleType && inDate(s.saleDate, where.saleDate)).reduce((sum, s) => sum + s.liters, 0) } }),
      findMany: async ({ where }) => sales.filter(s => inDate(s.saleDate, where.saleDate)),
      count: async () => sales.length,
      create: async ({ data }) => { const row = { id: `sale-${sales.length}`, ...data, createdAt: new Date(), updatedAt: new Date() }; sales.push(row); return row; },
    },
    bulkTankLog: { aggregate: async () => ({ _sum: { calfFeedingLiters: 0, wastedLiters: 0 } }), findMany: async () => [] },
    account: { findUnique: async ({ where }) => ({ id: where.farmId_code.code }), update: async () => ({}) },
    costCenter: { findFirst: async () => null },
    journalSequence: { upsert: async () => ({ nextNumber: sales.length + 2 }) },
    journalEntry: { create: async () => ({ id: `journal-${sales.length}` }) },
  };
  const service = new SalesService({ ...tx, $transaction: async callback => callback(tx) });
  const dto = { liters: 100, pricePerLiter: 1, paymentMethod: 'CASH', buyerName: 'Review', saleDate: '2030-09-02' };
  await assert.rejects(service.recordMilkSale(dto, 'farm'), /مخزون/);
  await service.updateMilkPolicy('farm', 'CARRY_OVER');
  await service.recordMilkSale(dto, 'farm');
  assert.equal(sales.length, 1);
  console.log(JSON.stringify({ source: 'live TypeScript', ration: { ingredients, target: 65.51, result, alternative, alternativeProtein, alternativeCost }, policyTransition: { productionDate: '2030-09-01', productionLiters: 100, saleDate: dto.saleDate, dailyResetRejected: true, afterCarryOverAcceptedLiters: sales[0].liters, interpretation: 'Switching policy reuses all historical production; no reset boundary or opening balance is recorded.' } }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
