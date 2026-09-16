// Run after building apps/api: node docs/audits/2026-09-15/review-ration-save.cjs
// Pure in-memory service probe. It never creates a database client or connection.
const { RationService } = require('../../../apps/api/dist/modules/nutrition/ration.service.js');

async function main() {
  const service = new RationService({
    $transaction() { throw new Error('Unexpected database access: probe must stop at validation'); },
  });
  const ingredients = [
    { id: 'A', name: 'A', proteinPct: 0, costPerKg: 1, energyMcal: 1, minInclusionPct: 33.33, maxInclusionPct: 33.33 },
    { id: 'B', name: 'B', proteinPct: 0, costPerKg: 1, energyMcal: 1 },
    { id: 'C', name: 'C', proteinPct: 40, costPerKg: 10, energyMcal: 1 },
  ];
  const result = service.calculateLeastCostRation(ingredients, { targetProteinPct: 20.01, batchTotalKg: 1000 });
  console.log(JSON.stringify({ optimization: result, percentageSum: result.items.reduce((sum, item) => sum + item.percentage, 0) }, null, 2));
  try {
    await service.createFormula({ name: 'Review probe', items: result.items.map(({ ingredientId, percentage }) => ({ ingredientId, percentage })) }, 'review-farm');
    throw new Error('Expected save validation rejection');
  } catch (error) {
    if (!error.message.includes('100%')) throw error;
    console.log(`Confirmed save rejection: ${error.message}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
