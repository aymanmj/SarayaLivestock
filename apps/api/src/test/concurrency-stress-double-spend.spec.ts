import {
  BadRequestException,
} from '@nestjs/common';
import {
  AnimalStatus,
  Gender,
  LifeStage,
  MilkingShift,
  PaymentMethod,
} from '@prisma/client';
import {
  createInMemoryState,
  createMockPrismaClient,
  seedTestAccounts,
  buildServices,
} from './farm-test-harness';
import { AuditActor } from '../common/audit/domain-audit';
import { IdempotencyContext } from '../common/idempotency/idempotency-context';
import { Money } from '../common/utils/money.util';

describe('Concurrency, Race Conditions & Double-Spend Stress Suite', () => {
  let state: any;
  let prisma: any;
  let services: ReturnType<typeof buildServices>;
  const farmId = 'farm-concurrency-01';
  let accounts: Record<string, string>;
  let yearId: string;

  beforeEach(async () => {
    state = createInMemoryState();
    const mock = createMockPrismaClient(state);
    prisma = mock.prisma;

    const seeded = await seedTestAccounts(prisma, farmId, 'مزرعة اختبار التزامن والضغط العالي');
    accounts = seeded.accounts;
    yearId = seeded.yearId;

    services = buildServices(prisma);
  });

  // 1. سباق السحب المتزامن من مخزون الحليب (Concurrent Milk Stock Depletion)
  it('prevents overselling milk under concurrent requests: exact stock allocation and zero deficit', async () => {
    const { animalsService, milkingService, salesService } = services;

    // تسجيل بقرة حلابة وتسجيل إنتاج 100 لتر حليب
    const cow = await animalsService.create({
      tagNumber: 'COW-CONCUR-01',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.LACTATING,
    }, farmId);

    await milkingService.logMilk({
      animalId: cow.id,
      logDate: '2026-06-01',
      shift: MilkingShift.MORNING,
      yieldLiters: 100,
    }, farmId);

    // إطلاق 10 طلبات بيع متزامنة في نفس اللحظة، كل طلب يطلب 20 لتر
    // إجمالي الطلب = 200 لتر، بينما المخزون = 100 لتر فقط
    const requests = Array.from({ length: 10 }, (_, i) =>
      salesService.recordMilkSale({
        liters: 20,
        pricePerLiter: 2.5,
        buyerName: `عميل متزامن رقم ${i + 1}`,
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-06-01',
      }, farmId)
    );

    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // يجب أن تنجح 5 عمليات بيع بالضبط (5 × 20 = 100 لتر)
    expect(fulfilled.length).toBe(5);

    // يجب أن تفشل الـ 5 عمليات الأخرى لمنع العجز والبيع على المكشوف
    expect(rejected.length).toBe(5);

    // فحص رسائل الخطأ للعمليات المرفوضة للتأكد من أنها رفضت بسبب نفاد المخزون
    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(BadRequestException);
        expect(r.reason.message).toContain('لا يوجد مخزون حليب كافٍ');
      }
    }

    // التحقق من أن عدد سجلات البيع في قاعدة البيانات هو 5 بالضبط
    const salesCount = await prisma.commercialSale.count({ where: { farmId, saleType: 'MILK' } });
    expect(salesCount).toBe(5);

    // التحقق من أن رصيد المخزون لم ينزل تحت الصفر أبداً
    const totalSold = await prisma.commercialSale.aggregate({
      where: { farmId, saleType: 'MILK' },
      _sum: { liters: true },
    });
    expect(totalSold._sum.liters).toBe(100);
  });

  // 2. منع الإنفاق المزدوج عند بيع الحيوان (Double-Spend Prevention on Animal Sale)
  it('prevents double-selling the exact same animal under concurrent sale attempts', async () => {
    const { animalsService, accountingService, salesService } = services;

    // تسجيل بقرة وإثبات أصلها في دفتر الأستاذ
    const cow = await animalsService.create({
      tagNumber: 'COW-DOUBLESPEND-01',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.HEIFER,
      purchasePrice: 6000,
    }, farmId);

    await accountingService.createJournalEntry({
      fiscalYearId: yearId,
      entryDate: '2026-01-01',
      description: 'إثبات أصل البقرة',
      lines: [
        { accountId: accounts['1201'], animalId: cow.id, debit: 6000, credit: 0 },
        { accountId: accounts['3101'], debit: 0, credit: 6000 },
      ],
    }, farmId);

    // إطلاق محاولتي بيع متزامنتين لنفس البقرة من قبل مشتريين مختلفين
    const req1 = salesService.recordAnimalSale({
      animalId: cow.id,
      pricingMethod: 'PER_HEAD' as any,
      pricePerHead: 6500,
      buyerName: 'المشتري الأول (أ)',
      paymentMethod: PaymentMethod.CASH,
      saleDate: '2026-06-15',
    }, farmId);

    const req2 = salesService.recordAnimalSale({
      animalId: cow.id,
      pricingMethod: 'PER_HEAD' as any,
      pricePerHead: 6700,
      buyerName: 'المشتري الثاني (ب)',
      paymentMethod: PaymentMethod.BANK,
      saleDate: '2026-06-15',
    }, farmId);

    const results = await Promise.allSettled([req1, req2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // عملية واحدة فقط يجب أن تنجح
    expect(fulfilled.length).toBe(1);

    // العملية الثانية يجب أن تُرفض قطعاً
    expect(rejected.length).toBe(1);
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      expect(rejected[0].reason.message).toContain('مسجل كمباع مسبقاً');
    }

    // التحقق من أن حالة الحيوان النهائية مباع SOLD
    const finalCow = await animalsService.findOne(cow.id, farmId);
    expect(finalCow.status).toBe(AnimalStatus.SOLD);

    // التحقق من استبعاد الأصل البيولوجي مرة واحدة فقط وعودة الحساب إلى 0
    const trialBalance = await accountingService.getTrialBalance(farmId, yearId);
    const dairyAsset = trialBalance.accounts.find(a => a.code === '1201');
    expect(dairyAsset?.netDebit).toBe(0);
  });

  // 3. عاصفة تكرار الطلبات المتطابقة (Idempotency Storm)
  it('handles simultaneous identical idempotency requests cleanly', async () => {
    const { animalsService, milkingService, salesService } = services;

    const cow = await animalsService.create({
      tagNumber: 'COW-IDEM-01',
      gender: Gender.FEMALE,
      currentLifeStage: LifeStage.LACTATING,
    }, farmId);

    await milkingService.logMilk({
      animalId: cow.id,
      logDate: '2026-07-01',
      shift: MilkingShift.MORNING,
      yieldLiters: 50,
    }, farmId);

    const actor: AuditActor = {
      id: 'user-001',
      orgId: 'org-test',
      farmId,
    };

    const idempotency: IdempotencyContext = {
      key: 'IDEM-KEY-STORM-777',
      requestHash: 'hash-abc-123',
      method: 'POST',
      path: '/api/v1/sales/milk',
    };

    // إطلاق 3 طلبات متزامنة تحمل نفس مفتاح الـ Idempotency-Key
    const stormRequests = Array.from({ length: 3 }, () =>
      salesService.recordMilkSale({
        liters: 15,
        pricePerLiter: 3.0,
        buyerName: 'موزع ألبان مركزي',
        paymentMethod: PaymentMethod.CASH,
        saleDate: '2026-07-01',
      }, farmId, actor, idempotency)
    );

    const results = await Promise.allSettled(stormRequests);
    const fulfilled = results.filter(r => r.status === 'fulfilled');

    // يجب تنفيذ العملية واعتمادها بنجاح دون أخطاء تعارض
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // التحقق من إنشاء فاتورة واحدة فقط في قاعدة البيانات وليس ثلاث فواتير
    const sales = await prisma.commercialSale.findMany({
      where: { farmId, saleType: 'MILK' },
    });
    expect(sales.length).toBe(1);
    expect(Number(sales[0].liters)).toBe(15);
  });

  // 4. اختبار التحمل المستمر وعالي الحجم (100 عملية متسلسلة)
  it('executes high-volume sequential stress pipeline (100 operations) with zero state drift', async () => {
    const { animalsService, milkingService, healthService, accountingService } = services;

    // تسجيل 10 أبقار
    const cows = [];
    for (let i = 1; i <= 10; i++) {
      const cow = await animalsService.create({
        tagNumber: `COW-BATCH-${i}`,
        gender: Gender.FEMALE,
        currentLifeStage: LifeStage.LACTATING,
      }, farmId);
      cows.push(cow);
    }
    expect(cows.length).toBe(10);

    // تنفيذ 30 عملية حلب
    for (let i = 0; i < 30; i++) {
      const cow = cows[i % cows.length];
      await milkingService.logMilk({
        animalId: cow.id,
        logDate: '2026-08-01',
        shift: i % 2 === 0 ? MilkingShift.MORNING : MilkingShift.EVENING,
        yieldLiters: 12 + (i % 5),
      }, farmId);
    }

    // تنفيذ 20 عملية علاج طبي بيطري
    for (let i = 0; i < 20; i++) {
      const cow = cows[i % cows.length];
      await healthService.recordTreatment({
        animalId: cow.id,
        treatmentDate: '2026-08-02',
        drugName: `دواء بيطري ${i + 1}`,
        dosage: '15 ml',
        diagnosis: 'فحص دوري',
        milkWithdrawalDays: i % 3 === 0 ? 3 : 0,
        treatmentCost: 40 + i,
      }, farmId);
    }

    // تنفيذ 40 قيد يومية متوازن مع كسور نقدية
    for (let i = 1; i <= 40; i++) {
      const cost = Money.round(50.25 * i + 0.125);
      await accountingService.createJournalEntry({
        fiscalYearId: yearId,
        entryDate: '2026-08-05',
        description: `قيد إجهاد مالي رقم ${i}`,
        lines: [
          { accountId: accounts['5101'], debit: cost, credit: 0 },
          { accountId: accounts['1101'], debit: 0, credit: cost },
        ],
      }, farmId);
    }

    // التحقق النهائي من توازن الدفاتر المحاسبية بنسبة 100% وعدم وجود أي انحراف
    const trialBalance = await accountingService.getTrialBalance(farmId, yearId);
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.totalDebits).toBe(trialBalance.totalCredits);
    expect(Money.isZero(Money.sub(trialBalance.totalDebits, trialBalance.totalCredits))).toBe(true);
  });
});
