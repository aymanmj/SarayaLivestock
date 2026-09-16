import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AnimalStatus,
  CalvingDifficulty,
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

describe('Operational Chaos & Biological Boundary Probes Suite', () => {
  let state: any;
  let prisma: any;
  let services: ReturnType<typeof buildServices>;
  const farmId = 'farm-chaos-01';
  let accounts: Record<string, string>;
  let yearId: string;

  beforeEach(async () => {
    state = createInMemoryState();
    const mock = createMockPrismaClient(state);
    prisma = mock.prisma;

    const seeded = await seedTestAccounts(prisma, farmId, 'مزرعة حافة الفوضى والحدود القصوى');
    accounts = seeded.accounts;
    yearId = seeded.yearId;

    services = buildServices(prisma);
  });

  // 1. الحدود البيولوجية: منع تلقيح أو حلب الذكور (BULLS)
  it('strictly prohibits biological impossibilities: milking or inseminating male animals', async () => {
    const { animalsService, breedingService, milkingService } = services;

    // تسجيل ثور ذكر بالغ
    const bull = await animalsService.create({
      tagNumber: 'BULL-999',
      name: 'صخر',
      gender: Gender.MALE,
      currentLifeStage: LifeStage.SIRE,
      entryWeightKg: 850,
      purchasePrice: 9000,
    }, farmId);

    expect(bull.gender).toBe(Gender.MALE);

    // محاولة تلقيح الثور الذكر -> يجب أن تُرفض
    await expect(
      breedingService.recordInsemination({
        animalId: bull.id,
        inseminationDate: '2026-02-01',
        semenCode: 'SEM-SAMPLE',
        inseminatorName: 'د. بيطري',
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // محاولة تسجيل حلب للثور الذكر -> يجب أن تُرفض
    await expect(
      milkingService.logMilk({
        animalId: bull.id,
        logDate: '2026-02-01',
        shift: MilkingShift.MORNING,
        yieldLiters: 10,
      }, farmId)
    ).rejects.toThrow(BadRequestException);
  });

  // 2. الحصانة ضد الحيوانات الوهمية (Ghost Animals)
  it('strictly rejects operations on non-existent animal IDs', async () => {
    const { milkingService, breedingService, healthService, salesService } = services;
    const ghostId = 'GHOST-ANIMAL-DOES-NOT-EXIST';

    await expect(
      milkingService.logMilk({
        animalId: ghostId,
        logDate: '2026-02-01',
        shift: MilkingShift.MORNING,
        yieldLiters: 12,
      }, farmId)
    ).rejects.toThrow(NotFoundException);

    await expect(
      breedingService.recordInsemination({
        animalId: ghostId,
        inseminationDate: '2026-02-01',
      }, farmId)
    ).rejects.toThrow(NotFoundException);

    await expect(
      healthService.recordTreatment({
        animalId: ghostId,
        treatmentDate: '2026-02-01',
        drugName: 'Oxytetracycline',
        dosage: '20ml',
        diagnosis: 'Infection',
      }, farmId)
    ).rejects.toThrow(NotFoundException);

    await expect(
      salesService.recordAnimalSale({
        animalId: ghostId,
        pricingMethod: 'PER_HEAD' as any,
        pricePerHead: 3000,
        buyerName: 'مشتري',
        paymentMethod: PaymentMethod.CASH,
      }, farmId)
    ).rejects.toThrow(NotFoundException);
  });

  // 3. منع تكرار أرقام الأقراط داخل المزرعة نفسها (Duplicate Tag Collision)
  it('strictly rejects registering duplicate tag numbers within the same farm', async () => {
    const { animalsService } = services;

    await animalsService.create({
      tagNumber: 'TAG-UNIQUE-101',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.HEIFER,
    }, farmId);

    // محاولة إنشاء حيوان آخر بنفس رقم القرط
    await expect(
      animalsService.create({
        tagNumber: 'TAG-UNIQUE-101',
        gender: Gender.FEMALE,
        currentLifeStage: LifeStage.CALF,
      }, farmId)
    ).rejects.toThrow(ConflictException);
  });

  // 4. الحصانة البيولوجية: استحالة فترات الحمل غير المنطقية
  it('enforces biological gestation boundaries and handles abortion correctly', async () => {
    const { animalsService, breedingService } = services;

    const cow = await animalsService.create({
      tagNumber: 'COW-BREED-202',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.HEIFER,
    }, farmId);

    const insem = await breedingService.recordInsemination({
      animalId: cow.id,
      inseminationDate: '2026-01-01',
      semenCode: 'SEM-SAMPLE',
    }, farmId);

    // محاولة تسجيل ولادة طبيعية بعد 10 أيام فقط من التلقيح -> مستحيلة بيولوجياً
    await expect(
      breedingService.recordCalving(insem.id, {
        actualCalvingDate: '2026-01-11',
        offspringTagNumber: 'CALF-IMPOSSIBLE',
        offspringGender: Gender.MALE,
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // تسجيل حالة إجهاض مبكر (ABORTION) -> يجب أن تُقبل وتُنهي الحمل دون إنشاء مولود حي
    const abortionResult = await breedingService.recordCalving(insem.id, {
      actualCalvingDate: '2026-02-15',
      offspringTagNumber: 'NOT-APPLICABLE',
      offspringGender: Gender.FEMALE,
      calvingDifficulty: CalvingDifficulty.ABORTION,
    }, farmId);

    expect(abortionResult).toBeDefined();
    expect(abortionResult.newborn).toBeNull();

    // محاولة تسجيل ولادة أخرى لنفس سجل التلقيح الذي انتهى بالإجهاض -> مرفوضة
    await expect(
      breedingService.recordCalving(insem.id, {
        actualCalvingDate: '2026-10-15',
        offspringTagNumber: 'CALF-SECOND',
        offspringGender: Gender.FEMALE,
      }, farmId)
    ).rejects.toThrow(ConflictException);
  });

  // 5. الحصانة ضد التعدي على الحيوانات المباعة أو النافقة (Zombie Operations)
  it('prevents any milking, treatments, or re-selling on DECEASED or SOLD animals', async () => {
    const { animalsService, salesService, milkingService, healthService, accountingService } = services;

    const cow = await animalsService.create({
      tagNumber: 'COW-ZOMBIE-303',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.HEIFER,
      purchasePrice: 4000,
    }, farmId);

    // إثبات قيمة الأصل في دفتر الأستاذ لتمكين البيع/النفوق
    await accountingService.createJournalEntry({
      fiscalYearId: yearId,
      entryDate: '2026-01-01',
      description: 'إثبات أصل البقرة',
      lines: [
        { accountId: accounts['1201'], animalId: cow.id, debit: 4000, credit: 0 },
        { accountId: accounts['3101'], debit: 0, credit: 4000 },
      ],
    }, farmId);

    // بيع البقرة تجارياً
    await salesService.recordAnimalSale({
      animalId: cow.id,
      pricingMethod: 'PER_HEAD' as any,
      pricePerHead: 4800,
      buyerName: 'تاجر مواشي',
      paymentMethod: PaymentMethod.CASH,
      saleDate: '2026-03-01',
    }, farmId);

    // محاولة بيع البقرة مرة ثانية -> يجب أن تُرفض
    await expect(
      salesService.recordAnimalSale({
        animalId: cow.id,
        pricingMethod: 'PER_HEAD' as any,
        pricePerHead: 5000,
        buyerName: 'تاجر آخر',
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-03-05',
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // محاولة تسجيل نفوق لبقرة تم بيعها -> يجب أن تُرفض
    await expect(
      salesService.recordAnimalMortality({
        animalId: cow.id,
        deathDate: '2026-03-10',
        causeOfDeath: 'مرض مفاجئ',
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // محاولة تسجيل حلب للبقرة المباعة -> يجب أن تُرفض
    await expect(
      milkingService.logMilk({
        animalId: cow.id,
        logDate: '2026-03-02',
        shift: MilkingShift.MORNING,
        yieldLiters: 15,
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // محاولة إعطاء علاج طبي للبقرة المباعة -> يجب أن تُرفض
    await expect(
      healthService.recordTreatment({
        animalId: cow.id,
        treatmentDate: '2026-03-03',
        drugName: 'Tylosin',
        dosage: '10ml',
        diagnosis: 'Pneumonia',
      }, farmId)
    ).rejects.toThrow(BadRequestException);
  });

  // 6. حدود المبيعات التجارية: منع الكميات السالبة واستنزاف المخزون
  it('enforces commercial boundaries: rejects negative volume and inventory deficits', async () => {
    const { salesService, animalsService, milkingService } = services;

    // تسجيل بقرة وإنتاج 20 لتر حليب
    const cow = await animalsService.create({
      tagNumber: 'COW-MILK-404',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.LACTATING,
    }, farmId);

    await milkingService.logMilk({
      animalId: cow.id,
      logDate: '2026-04-01',
      shift: MilkingShift.MORNING,
      yieldLiters: 20,
    }, farmId);

    // محاولة بيع حليب بكمية سالبة أو صفر
    await expect(
      salesService.recordMilkSale({
        liters: -5,
        pricePerLiter: 3.0,
        buyerName: 'مشتري',
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-04-01',
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // محاولة بيع كمية تتجاوز المتوفر (المتوفر 20 لتر والمطلوب 50 لتر)
    await expect(
      salesService.recordMilkSale({
        liters: 50,
        pricePerLiter: 3.0,
        buyerName: 'مشتري',
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-04-01',
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // بيع الكمية المتوفرة بالكامل (20 لتر) -> تنجح
    const successfulSale = await salesService.recordMilkSale({
      liters: 20,
      pricePerLiter: 3.0,
      buyerName: 'مشتري معتمد',
      paymentMethod: PaymentMethod.CASH,
      saleDate: '2026-04-01',
    }, farmId);

    expect(successfulSale.liters).toBe('20.000');

    // محاولة بيع حتى 0.1 لتر إضافي بعد استنفاد المخزون -> تفشل
    await expect(
      salesService.recordMilkSale({
        liters: 0.1,
        pricePerLiter: 3.0,
        buyerName: 'مشتري متأخر',
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-04-01',
      }, farmId)
    ).rejects.toThrow(BadRequestException);
  });

  // 7. حدود الخسائر والنفوق: قيمة الاسترداد (Salvage) لا تتجاوز القيمة الدفترية
  it('rejects salvage value exceeding biological book value during mortality', async () => {
    const { animalsService, accountingService, salesService } = services;

    const calf = await animalsService.create({
      tagNumber: 'CALF-MORT-505',
      gender: Gender.MALE,
      currentLifeStage: LifeStage.CALF,
      purchasePrice: 1500,
    }, farmId);

    await accountingService.createJournalEntry({
      fiscalYearId: yearId,
      entryDate: '2026-01-01',
      description: 'إثبات أصل العجل',
      lines: [
        { accountId: accounts['1202'], animalId: calf.id, debit: 1500, credit: 0 },
        { accountId: accounts['3101'], debit: 0, credit: 1500 },
      ],
    }, farmId);

    // محاولة إثبات نفوق بقيمة استرداد 2000 د.ل بينما القيمة الدفترية 1500 د.ل فقط
    await expect(
      salesService.recordAnimalMortality({
        animalId: calf.id,
        deathDate: '2026-05-15',
        causeOfDeath: 'انتفاخ وتسمم معوي',
        salvageValue: 2000,
      }, farmId)
    ).rejects.toThrow(BadRequestException);

    // تسجيل النفوق بقيمة استردادية صحيحة (300 د.ل)
    const validMortality = await salesService.recordAnimalMortality({
      animalId: calf.id,
      deathDate: '2026-05-15',
      causeOfDeath: 'انتفاخ وتسمم معوي',
      salvageValue: 300,
    }, farmId);

    expect(validMortality).toBeDefined();
    const finalCalfState = await animalsService.findOne(calf.id, farmId);
    expect(finalCalfState.status).toBe(AnimalStatus.DECEASED);
  });
});
