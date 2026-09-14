// Read-only production-readiness probes. Run from repository root:
// node docs/audits/2026-09-13/spec-probes.cjs
// Loads current TypeScript source; all persistence is mocked in memory.
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
require(path.join(root, 'apps/api/node_modules/ts-node')).register({
  transpileOnly: true,
  project: path.join(root, 'apps/api/tsconfig.json'),
});
const { RationService } = require(path.join(root, 'apps/api/src/modules/nutrition/ration.service'));
const { MilkingService } = require(path.join(root, 'apps/api/src/modules/milking/milking.service'));
const { BreedingService } = require(path.join(root, 'apps/api/src/modules/breeding/breeding.service'));

async function main() {
  const inputs = [
    { id: 'H', name: 'H', proteinPct: 40, costPerKg: 1, energyMcal: 0 },
    { id: 'L1', name: 'L1', proteinPct: 10, costPerKg: 0.3, energyMcal: 0 },
    { id: 'L2', name: 'L2', proteinPct: 5, costPerKg: 0.16, energyMcal: 0 },
  ];
  const target = { targetProteinPct: 20, batchTotalKg: 1000 };
  const service = new RationService({});
  const ration = service.calculateLeastCostRation(inputs, target);
  const alternativeCost = 1000 * (3 / 7 + (4 / 7) * 0.16);
  console.log(JSON.stringify({
    probe: 'least-cost claim',
    actualCost: ration.totalCost,
    feasibleAlternativeCost: alternativeCost,
    alternativeProteinPct: (3 / 7) * 40 + (4 / 7) * 5,
    defectObserved: ration.totalCost > alternativeCost,
  }));
  const limited = service.calculateLeastCostRation([
    { ...inputs[0], maxInclusionPct: 10 }, inputs[1],
  ], target);
  console.log(JSON.stringify({
    probe: 'maximum inclusion constraint',
    maximumPct: 10,
    actualPct: limited.items.find(item => item.ingredientId === 'H').percentage,
    defectObserved: limited.items.find(item => item.ingredientId === 'H').percentage > 10,
  }));

  const animal = { id: 'cow', withdrawalEndDate: new Date('2026-09-01T00:00:00Z') };
  const milkTx = {
    animal: { findFirst: async () => animal },
    milkLog: { findMany: async () => [], create: async ({ data }) => data },
  };
  const milk = await new MilkingService({ $transaction: async cb => cb(milkTx) }).logMilk({
    animalId: 'cow', logDate: '2026-08-31', shift: 'MORNING', yieldLiters: 20,
  }, 'farm');
  console.log(JSON.stringify({
    probe: 'historical milk within withdrawal entered after withdrawal expires',
    runtimeUtc: new Date().toISOString(),
    logDate: milk.milkLog.logDate,
    withdrawalEndDate: animal.withdrawalEndDate,
    actualIsDiscarded: milk.milkLog.isDiscarded,
    defectObserved: !milk.milkLog.isDiscarded,
  }));

  const record = {
    id: 'breeding', animalId: 'cow', inseminationDate: new Date('2026-01-01'),
    actualCalvingDate: new Date('2026-09-01'), pdResult: 'PREGNANT',
    animal: { species: 'CATTLE', breed: 'test', barnId: null },
  };
  const breedingTx = {
    breedingRecord: {
      findFirst: async () => record,
      update: async ({ data }) => Object.assign(record, data),
    },
    animal: {
      findFirst: async () => null, update: async () => ({}),
      create: async ({ data }) => data,
    },
  };
  let calvingError = null;
  let calving = null;
  try {
    calving = await new BreedingService({ $transaction: async cb => cb(breedingTx) })
      .recordCalving('breeding', {
        actualCalvingDate: '2026-09-10', offspringTagNumber: 'second-newborn', offspringGender: 'MALE',
      }, 'farm');
  } catch (error) {
    calvingError = error;
  }
  console.log(JSON.stringify({
    probe: 'repeat completed calving with a new offspring tag',
    rejectedWithConflict: !!calvingError,
    errorMessage: calvingError?.message,
    defectObserved: !calvingError,
  }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
