// Review artifact only. Current TypeScript, in-memory data; no DB or network writes.
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
require(path.join(root, 'apps/api/node_modules/ts-node')).register({
  transpileOnly: true,
  project: path.join(root, 'apps/api/tsconfig.json'),
});
const { ReportsService } = require(path.join(root, 'apps/api/src/modules/reports/reports.service'));
const { Money } = require(path.join(root, 'apps/api/src/common/utils/money.util'));
async function main() {
  const original = process.env.MILK_PRICE_PER_LITER;
  process.env.MILK_PRICE_PER_LITER = '3.5';
  try {
    const service = new ReportsService({ milkLog: { findMany: async () => [] } });
    await service.getFinancialOverview('audit-farm');
    console.log(JSON.stringify({ probe: 'configured-milk-price', failed: false }));
  } catch (error) {
    console.log(JSON.stringify({ probe: 'configured-milk-price', failed: true, error: error.message }));
  } finally {
    if (original === undefined) delete process.env.MILK_PRICE_PER_LITER;
    else process.env.MILK_PRICE_PER_LITER = original;
  }
  try {
    const result = Money.divide(1000, 0);
    console.log(JSON.stringify({ probe: 'legacy-money-divide-zero', throws: false, result: result.toString() }));
  } catch (error) {
    console.log(JSON.stringify({ probe: 'legacy-money-divide-zero', throws: true, error: error.message }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
