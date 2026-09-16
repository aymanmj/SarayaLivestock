// Run after building apps/api. No database client or connection is created.
const assert = require('node:assert/strict');
const { RationService } = require('../../../apps/api/dist/modules/nutrition/ration.service.js');
const ingredients = [
  { id: 'A', name: 'A', proteinPct: 15, costPerKg: 1, energyMcal: 1 },
  { id: 'B', name: 'B', proteinPct: 16, costPerKg: 2, energyMcal: 1 },
  { id: 'C', name: 'C', proteinPct: 99, costPerKg: 84, energyMcal: 1 },
];
const target = 15.01;
const result = new RationService({}).calculateLeastCostRation(ingredients, { targetProteinPct: target, batchTotalKg: 1000 });
const percentages = ingredients.map(ingredient => result.items.find(item => item.ingredientId === ingredient.id)?.percentage ?? 0);
const alternative = [99.83, 0.16, 0.01];
const protein = values => values.reduce((sum, value, i) => sum + value * ingredients[i].proteinPct / 100, 0);
const cost = values => values.reduce((sum, value, i) => sum + value * 10 * ingredients[i].costPerKg, 0);
assert.equal(alternative.reduce((sum, value) => sum + Math.round(value * 100), 0), 10000);
assert.ok(alternative.every(value => value >= 0 && value <= 100));
assert.ok(protein(alternative) >= target - 1e-9);
assert.ok(result.totalCost > cost(alternative) + 0.001, 'Expected rounded optimizer to cost more than the valid alternative');
console.log(JSON.stringify({
  targetProtein: target,
  batchKg: 1000,
  returned: { percentages, protein: protein(percentages), cost: result.totalCost },
  validAlternative: { percentages: alternative, protein: protein(alternative), cost: cost(alternative) },
  excessCost: Number((result.totalCost - cost(alternative)).toFixed(2)),
}, null, 2));
