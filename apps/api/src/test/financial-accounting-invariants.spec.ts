import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountCategory,
  FiscalStatus,
  JournalEntryType,
  PaymentMethod,
} from '@prisma/client';
import {
  createInMemoryState,
  createMockPrismaClient,
  seedTestAccounts,
  buildServices,
} from './farm-test-harness';
import { Money } from '../common/utils/money.util';

describe('Financial & Accounting Invariants Suite (IAS 41 & Double-Entry Invariants)', () => {
  let state: any;
  let prisma: any;
  let services: ReturnType<typeof buildServices>;
  const farmIdA = 'farm-alpha-01';
  const farmIdB = 'farm-beta-02';
  let accountsA: Record<string, string>;
  let accountsB: Record<string, string>;
  let yearIdA: string;
  let yearIdB: string;

  beforeEach(async () => {
    state = createInMemoryState();
    const mock = createMockPrismaClient(state);
    prisma = mock.prisma;

    const seededA = await seedTestAccounts(prisma, farmIdA, 'مزرعة ألفا النموذجية');
    accountsA = seededA.accounts;
    yearIdA = seededA.yearId;

    const seededB = await seedTestAccounts(prisma, farmIdB, 'مزرعة بيتا النموذجية');
    accountsB = seededB.accounts;
    yearIdB = seededB.yearId;

    services = buildServices(prisma);
  });

  // 1. التوازن الرياضي الصارم لكل قيد
  it('enforces mathematical equality (Debit === Credit) and rejects unbalanced entries', async () => {
    const { accountingService } = services;

    // محاولة إنشاء قيد غير متوازن (1000 مدين مقابل 900 دائن)
    await expect(
      accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-03-15',
        description: 'قيد تجريبي غير متوازن',
        lines: [
          { accountId: accountsA['1101'], debit: 1000, credit: 0 },
          { accountId: accountsA['4101'], debit: 0, credit: 900 },
        ],
      }, farmIdA)
    ).rejects.toThrow(BadRequestException);

    // محاولة إنشاء سطر يحتوي على مدين ودائن معاً
    await expect(
      accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-03-15',
        description: 'قيد به سطر مشوه',
        lines: [
          { accountId: accountsA['1101'], debit: 500, credit: 500 },
          { accountId: accountsA['4101'], debit: 0, credit: 500 },
        ],
      }, farmIdA)
    ).rejects.toThrow(BadRequestException);

    // محاولة إنشاء قيد بدون أسطر
    await expect(
      accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-03-15',
        description: 'قيد فارغ',
        lines: [],
      }, farmIdA)
    ).rejects.toThrow(BadRequestException);

    // إنشاء قيد متوازن تماماً
    const balancedEntry = await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-03-15',
      description: 'إيداع رأس مال نقدي إضافي',
      lines: [
        { accountId: accountsA['1101'], debit: 50000.755, credit: 0 },
        { accountId: accountsA['3101'], debit: 0, credit: 50000.755 },
      ],
    }, farmIdA);

    expect(balancedEntry).toBeDefined();
    expect(balancedEntry.totalDebit).toBe(50000.755);
    expect(balancedEntry.totalCredit).toBe(50000.755);
  });

  // 2. ميزان المراجعة بدون انحراف (Zero-Drift Trial Balance)
  it('guarantees zero-drift balance in trial balance under high transaction volume with 3 decimals', async () => {
    const { accountingService } = services;

    // تسجيل 30 عملية مالية مختلفة بأرقام وكسور عشرية متنوعة
    for (let i = 1; i <= 30; i++) {
      const amount = Money.round(100.123 * i + (i % 3) * 0.333);
      await accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-04-10',
        description: `قيد تشغيلي رقم ${i}`,
        lines: [
          { accountId: accountsA['5101'], debit: amount, credit: 0, memo: 'شراء وتغذية أعلاف' },
          { accountId: accountsA['1101'], debit: 0, credit: amount, memo: 'صرف من الخزينة' },
        ],
      }, farmIdA);
    }

    const trialBalance = await accountingService.getTrialBalance(farmIdA, yearIdA);
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.totalDebits).toBe(trialBalance.totalCredits);
    expect(Money.sub(trialBalance.totalDebits, trialBalance.totalCredits)).toBe(0);
  });

  // 3. معادلة الميزانية العمومية والمركز المالي
  it('satisfies the fundamental accounting equation: Assets = Liabilities + Equity + Net Profit', async () => {
    const { accountingService } = services;

    // 1. قيد رأسمال افتتاحي: مدين نقدية 100,000 د.ل مقابل دائن رأس مال 100,000 د.ل
    await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-01-01',
      description: 'رأس مال افتتاحي',
      lines: [
        { accountId: accountsA['1101'], debit: 100000, credit: 0 },
        { accountId: accountsA['3101'], debit: 0, credit: 100000 },
      ],
    }, farmIdA);

    // 2. شراء أعلاف نقدياً: مدين مخزون أعلاف 25,000 د.ل مقابل دائن نقدية 25,000 د.ل
    await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-02-01',
      description: 'شراء مخزون أعلاف',
      lines: [
        { accountId: accountsA['1104'], debit: 25000, credit: 0 },
        { accountId: accountsA['1101'], debit: 0, credit: 25000 },
      ],
    }, farmIdA);

    // 3. تسجيل مصروف أعلاف: مدين مصروف أعلاف 10,000 د.ل مقابل دائن مخزون أعلاف 10,000 د.ل
    await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-03-01',
      description: 'استهلاك أعلاف القطيع',
      lines: [
        { accountId: accountsA['5101'], debit: 10000, credit: 0 },
        { accountId: accountsA['1104'], debit: 0, credit: 10000 },
      ],
    }, farmIdA);

    // 4. إيراد مبيعات حليب: مدين نقدية 18,500 د.ل مقابل دائن إيرادات حليب 18,500 د.ل
    await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-03-15',
      description: 'إيراد مبيعات حليب',
      lines: [
        { accountId: accountsA['1101'], debit: 18500, credit: 0 },
        { accountId: accountsA['4101'], debit: 0, credit: 18500 },
      ],
    }, farmIdA);

    // استخراج الميزانية العمومية والتحقق من التوازن الصارم
    const balanceSheet = await accountingService.getBalanceSheet(farmIdA, yearIdA);
    expect(balanceSheet.isBalanced).toBe(true);

    // صافي الربح = الإيرادات (18,500) - المصروفات (10,000) = 8,500
    const incomeStatement = await accountingService.getIncomeStatement(farmIdA, yearIdA);
    expect(incomeStatement.netProfit).toBe(8500);

    // الأصول = نقدية (100,000 - 25,000 + 18,500 = 93,500) + مخزون (25,000 - 10,000 = 15,000) = 108,500
    expect(balanceSheet.totalAssets).toBe(108500);

    // الالتزامات = 0، حقوق الملكية = رأس مال (100,000) + صافي ربح (8,500) = 108,500
    expect(balanceSheet.totalLiabilities).toBe(0);
    expect(balanceSheet.totalEquity).toBe(108500);
    expect(balanceSheet.totalAssets).toBe(balanceSheet.totalLiabilities + balanceSheet.totalEquity);
  });

  // 4. الحظر الصارم للترحيل في الفترات المقفلة
  it('strictly blocks transactions in closed fiscal periods', async () => {
    const { accountingService } = services;

    // جلب الفترة الأولى (شهر يناير 2026)
    const periods = await prisma.fiscalPeriod.findMany({
      where: { fiscalYearId: yearIdA },
      orderBy: { periodNumber: 'asc' },
    });
    const periodJan = periods[0];
    expect(periodJan.periodNumber).toBe(1);

    // إقفال شهر يناير
    await accountingService.closePeriod(periodJan.id, farmIdA);

    // محاولة إنشاء قيد بتاريخ يقع داخل يناير (2026-01-20) -> يجب أن يفشل
    await expect(
      accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-01-20',
        description: 'قيد بأثر رجعي في فترة مقفلة',
        lines: [
          { accountId: accountsA['1101'], debit: 1000, credit: 0 },
          { accountId: accountsA['3101'], debit: 0, credit: 1000 },
        ],
      }, farmIdA)
    ).rejects.toThrow(BadRequestException);

    // إعادة فتح الفترة والسماح بالقيد
    await accountingService.reopenPeriod(periodJan.id, farmIdA);

    const allowedEntry = await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-01-20',
      description: 'قيد بعد إعادة فتح الفترة',
      lines: [
        { accountId: accountsA['1101'], debit: 1000, credit: 0 },
        { accountId: accountsA['3101'], debit: 0, credit: 1000 },
      ],
    }, farmIdA);

    expect(allowedEntry.id).toBeDefined();
  });

  // 5. العزل التام بين المزارع والحسابات المتعددة (Multi-Tenant Isolation)
  it('strictly isolates financial books between independent farms', async () => {
    const { accountingService } = services;

    // تسجيل عمليات مالية في المزرعة أ
    await accountingService.createJournalEntry({
      fiscalYearId: yearIdA,
      entryDate: '2026-05-01',
      description: 'تمويل المزرعة ألفا',
      lines: [
        { accountId: accountsA['1101'], debit: 200000, credit: 0 },
        { accountId: accountsA['3101'], debit: 0, credit: 200000 },
      ],
    }, farmIdA);

    // التحقق من أن المزرعة ب لا تتأثر تماماً ورصيدها صفري
    const tbB = await accountingService.getTrialBalance(farmIdB, yearIdB);
    expect(tbB.totalDebits).toBe(0);
    expect(tbB.totalCredits).toBe(0);

    // محاولة استخدام حساب من المزرعة أ داخل قيد للمزرعة ب -> يجب أن يُرفض فوراً
    await expect(
      accountingService.createJournalEntry({
        fiscalYearId: yearIdB,
        entryDate: '2026-05-01',
        description: 'قيد تسلل عبر المزارع',
        lines: [
          { accountId: accountsA['1101'], debit: 5000, credit: 0 }, // حساب ينتمي لمزرعة أخرى!
          { accountId: accountsB['3101'], debit: 0, credit: 5000 },
        ],
      }, farmIdB)
    ).rejects.toThrow(NotFoundException);
  });

  // 6. تسلسل أرقام القيود المحاسبية دون فجوات أو تكرار
  it('generates strictly sequential and monotonic journal entry numbers', async () => {
    const { accountingService } = services;

    const entryNumbers: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const entry = await accountingService.createJournalEntry({
        fiscalYearId: yearIdA,
        entryDate: '2026-06-01',
        description: `قيد تسلسلي ${i}`,
        lines: [
          { accountId: accountsA['1101'], debit: 100 * i, credit: 0 },
          { accountId: accountsA['3101'], debit: 0, credit: 100 * i },
        ],
      }, farmIdA);
      entryNumbers.push(entry.entryNumber);
    }

    expect(entryNumbers).toEqual([
      'JV-2026-000001',
      'JV-2026-000002',
      'JV-2026-000003',
      'JV-2026-000004',
      'JV-2026-000005',
    ]);
  });
});
