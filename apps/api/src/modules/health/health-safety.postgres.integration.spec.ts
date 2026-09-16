import { PrismaService } from '../../database/prisma.service';
import { MilkingService } from '../milking/milking.service';
import { HealthService } from './health.service';
import { BreedingService } from '../breeding/breeding.service';
import { AnimalsService } from '../animals/animals.service';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
describeDatabase('Operational safety regressions', () => {
  let db: PrismaService;
  beforeAll(async () => { db = new PrismaService(); await db.$connect(); });
  afterAll(async () => { if (db) await db.onModuleDestroy(); });
  async function cow() {
    const org = await db.organization.create({ data: { name: 'Safety regression' } });
    const farm = await db.farm.create({ data: { orgId: org.id, name: 'Isolated safety farm' } });
    return db.animal.create({ data: { farmId: farm.id, tagNumber: 'DAM', currentLifeStage: 'LACTATING', gender: 'FEMALE' } });
  }
  it('discards historical milk during its treatment interval, but does not use meat withdrawal for later milk', async () => {
    const animal = await cow();
    await new HealthService(db).recordTreatment({ animalId: animal.id, diagnosis: 'test', drugName: 'test', dosage: 'test', treatmentDate: '2026-08-27', milkWithdrawalDays: 5, meatWithdrawalDays: 20 }, animal.farmId);
    const service = new MilkingService(db);
    const during = await service.logMilk({ animalId: animal.id, logDate: '2026-08-31', shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
    expect(during.milkLog.isDiscarded).toBe(true);
    const after = await service.logMilk({ animalId: animal.id, logDate: '2026-09-03', shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
    expect(after.milkLog.isDiscarded).toBe(false);
    const before = await service.logMilk({ animalId: animal.id, logDate: '2026-08-01', shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
    expect(before.milkLog.isDiscarded).toBe(false);
  });
  it('reclassifies affected saved milk when a treatment is entered retrospectively', async () => {
    const animal = await cow();
    await new MilkingService(db).logMilk({ animalId: animal.id, logDate: '2026-08-31', shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
    await new HealthService(db).recordTreatment({ animalId: animal.id, diagnosis: 'test', drugName: 'test', dosage: 'test', treatmentDate: '2026-08-27', milkWithdrawalDays: 5 }, animal.farmId);
    const summary = await new MilkingService(db).getDailyFarmSummary(animal.farmId, '2026-08-31');
    expect(summary.usableLiters).toBe(0);
    expect(summary.discardedLiters).toBe(10);
  });
  it('does not discard milk for meat-only treatment, including historical days', async () => {
    const animal = await cow();
    await new HealthService(db).recordTreatment({ animalId: animal.id, diagnosis: 'test', drugName: 'test', dosage: 'test', treatmentDate: '2026-08-27', milkWithdrawalDays: 0, meatWithdrawalDays: 20 }, animal.farmId);
    for (const logDate of ['2026-08-01', '2026-08-27', '2026-09-03']) {
      const result = await new MilkingService(db).logMilk({ animalId: animal.id, logDate, shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
      expect(result.milkLog.isDiscarded).toBe(false);
    }
  });
  it('rejects a second completed calving even with a different request and newborn tag', async () => {
    const animal = await cow();
    const record = await db.breedingRecord.create({ data: { animalId: animal.id, inseminationDate: new Date('2025-12-01'), pdResult: 'PREGNANT' } });
    const service = new BreedingService(db);
    await service.recordCalving(record.id, { actualCalvingDate: '2026-08-31', offspringTagNumber: 'FIRST', offspringGender: 'MALE' }, animal.farmId);
    await expect(service.recordCalving(record.id, { actualCalvingDate: '2026-09-01', offspringTagNumber: 'SECOND', offspringGender: 'FEMALE' }, animal.farmId)).rejects.toThrow();
  });
  it('reclassifies same-day milk when treatment includes a time of day', async () => {
    const animal = await cow();
    const milk = new MilkingService(db);
    await milk.logMilk({ animalId: animal.id, logDate: '2026-08-31', shift: 'MORNING', yieldLiters: 10 }, animal.farmId);
    await new HealthService(db).recordTreatment({ animalId: animal.id, diagnosis: 'test', drugName: 'test', dosage: 'test', treatmentDate: '2026-08-31T14:30:00Z', milkWithdrawalDays: 5 }, animal.farmId);
    expect((await milk.getDailyFarmSummary(animal.farmId, '2026-08-31')).discardedLiters).toBe(10);
    const laterEntry = await milk.logMilk({ animalId: animal.id, logDate: '2026-08-31', shift: 'EVENING', yieldLiters: 12 }, animal.farmId);
    expect(laterEntry.milkLog.isDiscarded).toBe(true);
  });
  it('does not offer or allow drying off a completed pregnancy', async () => {
    const animal = await cow();
    const record = await db.breedingRecord.create({ data: {
      animalId: animal.id, inseminationDate: new Date('2025-12-01'),
      pdResult: 'PREGNANT', expectedDryoffDate: new Date('2026-07-01'),
    } });
    const breeding = new BreedingService(db);
    await breeding.recordCalving(record.id, { actualCalvingDate: '2026-09-01', offspringTagNumber: 'CALF', offspringGender: 'FEMALE' }, animal.farmId);
    expect((await breeding.getUpcomingTasks(animal.farmId)).pendingDryOffs).toHaveLength(0);
    await expect(new AnimalsService(db).updateLifeStage(animal.id, 'DRY', animal.farmId)).rejects.toThrow();
    await expect(breeding.recordDryOff(record.id, animal.farmId)).rejects.toThrow();

    // Verify active pregnancy can be dried off
    const pregnantCow = await cow();
    const activePregnancy = await db.breedingRecord.create({ data: {
      animalId: pregnantCow.id, inseminationDate: new Date('2025-12-01'),
      pdResult: 'PREGNANT', expectedDryoffDate: new Date(),
    } });
    const driedOff = await breeding.recordDryOff(activePregnancy.id, pregnantCow.farmId);
    expect(driedOff.currentLifeStage).toBe('DRY');
  });
});
