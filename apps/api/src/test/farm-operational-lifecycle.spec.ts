import {
  AnimalStatus,
  Gender,
  LifeStage,
  MilkingShift,
  PaymentMethod,
  PregnancyResult,
} from '@prisma/client';
import {
  createInMemoryState,
  createMockPrismaClient,
  seedTestAccounts,
  buildServices,
} from './farm-test-harness';

describe('Farm Operational & Biological Lifecycle Suite', () => {
  let state: any;
  let prisma: any;
  let services: ReturnType<typeof buildServices>;
  const farmId = 'farm-test-01';
  let accounts: Record<string, string>;
  let yearId: string;

  beforeEach(async () => {
    state = createInMemoryState();
    const mock = createMockPrismaClient(state);
    prisma = mock.prisma;
    const seeded = await seedTestAccounts(prisma, farmId, 'مزرعة السرايا للإنتاج الحيواني');
    accounts = seeded.accounts;
    yearId = seeded.yearId;
    services = buildServices(prisma);
  });

  it('orchestrates a full herd lifecycle from birth, breeding, milking, treatment, dry-off, to commercial sale', async () => {
    const {
      barnsService,
      animalsService,
      breedingService,
      milkingService,
      healthService,
      salesService,
      accountingService,
    } = services;

    // 1. إنشاء الحظائر التشغيلية
    const maternityBarn = await barnsService.createBarn(farmId, {
      name: 'عنبر الولادة والأمهات',
      capacity: 50,
    });
    expect(maternityBarn.id).toBeDefined();

    // 2. تسجيل بقرة بالغة من قطيع الألبان
    const dam = await animalsService.create({
      tagNumber: 'COW-101',
      name: 'جميلة',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.HEIFER,
      barnId: maternityBarn.id,
      entryWeightKg: 520,
      purchasePrice: 4500,
    }, farmId);
    expect(dam.id).toBeDefined();
    expect(dam.status).toBe(AnimalStatus.ACTIVE);

    // 3. التلقيح الاصطناعي
    const insemDate = '2026-01-15';
    const insem = await breedingService.recordInsemination({
      animalId: dam.id,
      inseminationDate: insemDate,
      semenCode: 'SEM-HOLSTEIN-X99',
      inseminatorName: 'د. خالد البيطري',
    }, farmId);
    expect(insem.id).toBeDefined();

    // 4. فحص الحمل (PD Check) وتأكيد الإخصاب
    const pdConfirmed = await breedingService.recordPdResult(
      insem.id,
      PregnancyResult.PREGNANT,
      farmId,
    );
    expect(pdConfirmed.pdResult).toBe(PregnancyResult.PREGNANT);

    // 5. الولادة وولادة مولود أنثى (Calving)
    const calvingDate = '2026-10-22';
    const calvingResult = await breedingService.recordCalving(insem.id, {
      actualCalvingDate: calvingDate,
      offspringTagNumber: 'CALF-201',
      offspringGender: Gender.FEMALE,
      offspringWeightKg: 42,
    }, farmId);
    expect(calvingResult).toBeDefined();
    expect(calvingResult.newborn).toBeDefined();

    // التحقق من إنشاء سجل المولود تلقائياً
    const newborn = await animalsService.findOne(calvingResult.newborn.id, farmId);
    expect(newborn).toBeDefined();
    expect(newborn.tagNumber).toBe('CALF-201');
    expect(newborn.motherId).toBe(dam.id);
    expect(newborn.gender).toBe(Gender.FEMALE);
    expect(newborn.currentLifeStage).toBe(LifeStage.CALF);

    // التحقق من تحديث حالة الأم إلى حلابة LACTATING
    const updatedDam = await animalsService.findOne(dam.id, farmId);
    expect(updatedDam.currentLifeStage).toBe(LifeStage.LACTATING);

    // 6. تسجيل ورديات الحلب اليومية
    const milkLog1 = await milkingService.logMilk({
      animalId: dam.id,
      logDate: '2026-10-25',
      shift: MilkingShift.MORNING,
      yieldLiters: 16.5,
      fatPct: 3.8,
      proteinPct: 3.2,
    }, farmId);
    expect(milkLog1.milkLog.yieldLiters).toBe(16.5);
    expect(milkLog1.milkLog.isDiscarded).toBe(false);

    const milkLog2 = await milkingService.logMilk({
      animalId: dam.id,
      logDate: '2026-10-25',
      shift: MilkingShift.EVENING,
      yieldLiters: 14.0,
      fatPct: 3.9,
      proteinPct: 3.3,
    }, farmId);
    expect(milkLog2.milkLog.yieldLiters).toBe(14.0);

    // 7. المعالجة البيطرية وفترة التحريم (Antibiotic Treatment & Milk Withdrawal)
    const treatment = await healthService.recordTreatment({
      animalId: dam.id,
      diagnosis: 'التهاب رئوي خفيف',
      drugName: 'Penicillin-Streptomycin',
      dosage: '25 ml',
      treatmentDate: '2026-10-26',
      milkWithdrawalDays: 4,
      treatmentCost: 75.5,
    }, farmId);
    expect(treatment.treatment.withdrawalEndDate).toBeDefined();

    // 8. حلب البقرة أثناء فترة التحريم -> يجب أن يُوسم الحليب كمهدر تلقائياً
    const withheldMilking = await milkingService.logMilk({
      animalId: dam.id,
      logDate: '2026-10-27',
      shift: MilkingShift.MORNING,
      yieldLiters: 15.0,
    }, farmId);
    expect(withheldMilking.milkLog.isDiscarded).toBe(true);
    expect(withheldMilking.safetyWarning).toContain('حليب مهدر إجبارياً');

    // 9. بيع الحليب التجاري الصالح فقط
    // في 2026-10-25 كان المتاح 30.5 لتر. نبيع 30 لتر
    const milkSale = await salesService.recordMilkSale({
      liters: 30,
      pricePerLiter: 2.5,
      buyerName: 'شركة النقاء للألبان',
      paymentMethod: PaymentMethod.CASH,
      saleDate: '2026-10-25',
    }, farmId);
    expect(milkSale.liters).toBe('30.000');
    expect(milkSale.totalAmount).toBe('75.000');

    // 10. الاعتراف بأصل البقرة في دفتر الأستاذ وبيعه
    await accountingService.createJournalEntry({
      fiscalYearId: yearId,
      entryDate: '2026-01-01',
      description: 'إثبات قيمة أصل البقرة الحلابة',
      lines: [
        { accountId: accounts['1201'], animalId: dam.id, debit: 4500, credit: 0 },
        { accountId: accounts['3101'], debit: 0, credit: 4500 },
      ],
    }, farmId);

    // بيع البقرة بعد انتهاء فترة الإدرار
    const animalSale = await salesService.recordAnimalSale({
      animalId: dam.id,
      pricingMethod: 'PER_HEAD' as any,
      pricePerHead: 5200,
      buyerName: 'مربي ماشية',
      paymentMethod: PaymentMethod.CASH,
      saleDate: '2026-11-15',
    }, farmId);

    expect(animalSale.totalAmount).toBe('5200.000');

    // التحقق من تحول حالة البقرة إلى مباعة SOLD
    const finalDamState = await animalsService.findOne(dam.id, farmId);
    expect(finalDamState.status).toBe(AnimalStatus.SOLD);

    // التحقق من استبعاد قيمة الأصل البيولوجي من الحساب 1201
    const trialBalance = await accountingService.getTrialBalance(farmId, yearId);
    const dairyAssetAcc = trialBalance.accounts.find(a => a.code === '1201');
    expect(dairyAssetAcc?.netDebit).toBe(0);
  });
});
