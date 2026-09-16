// Review probe: compiled services and in-memory data only. No database access.
const assert = require('node:assert/strict');
const { BreedingService } = require('../../../apps/api/dist/modules/breeding/breeding.service');
const { AnimalsService } = require('../../../apps/api/dist/modules/animals/animals.service');
const mother = { id: 'mother', farmId: 'farm', currentLifeStage: 'DRY', species: 'CATTLE', barnId: 'barn' };
const record = {
  id: 'pregnancy', animalId: mother.id, animal: mother, pdResult: 'PREGNANT',
  actualCalvingDate: null, inseminationDate: new Date('2025-12-01'),
  expectedDryoffDate: new Date('2026-07-01'), expectedCalvingDate: new Date('2026-09-01'),
};
const queries = [];
// Evaluate every predicate issued by getUpcomingTasks, rather than returning a
// canned record regardless of the service's filters.
function matches(value, where) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = value[key];
    if (expected === null) return actual === null;
    if (typeof expected === 'object') {
      if ('lte' in expected) return actual != null && actual <= expected.lte;
      return actual != null && matches(actual, expected);
    }
    return actual === expected;
  });
}
const tx = {
  animal: {
    findFirst: async ({ where }) => where.tagNumber ? null : mother,
    update: async ({ data }) => Object.assign(mother, data),
    create: async ({ data }) => ({ id: 'newborn', ...data }),
  },
  breedingRecord: {
    findFirst: async () => record,
    update: async ({ data }) => Object.assign(record, data),
    findMany: async ({ where }) => {
      queries.push(where);
      return matches(record, where) ? [record] : [];
    },
  },
};
const prisma = { ...tx, $transaction: async fn => fn(tx) };
async function main() {
  const breeding = new BreedingService(prisma);
  await breeding.recordCalving('pregnancy', {
    actualCalvingDate: '2026-09-01', calvingDifficulty: 'NORMAL',
    offspringTagNumber: 'newborn-tag', offspringGender: 'FEMALE',
  }, 'farm');
  assert.equal(record.pdResult, 'PREGNANT');
  assert.equal(mother.currentLifeStage, 'LACTATING');
  const tasks = await breeding.getUpcomingTasks('farm');
  assert.equal(tasks.pendingDryOffs.length, 1);
  assert.ok(tasks.pendingDryOffs[0].actualCalvingDate);
  await new AnimalsService(prisma).updateLifeStage('mother', 'DRY', 'farm');
  assert.equal(mother.currentLifeStage, 'DRY');
  console.log(JSON.stringify({
    reproduced: true, completedCalving: record.actualCalvingDate,
    retainedPregnancyResult: record.pdResult,
    completedRecordReturnedAsDryOff: tasks.pendingDryOffs.length,
    motherStageAfterNewUIAction: mother.currentLifeStage,
    actualDryOffWhere: queries[1],
    limitations: 'In-memory service probe; no browser or PostgreSQL integration.',
  }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
