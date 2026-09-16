import { Money } from '../../common/utils/money.util';
import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccountCategory, FiscalStatus, JournalEntryType, JournalEntryStatus, Prisma } from '@prisma/client';
import { CreateAccountDto, CreateJournalEntryDto, CreateFiscalYearDto } from './dto/accounting.dto';
import { Decimal } from 'decimal.js';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

const SYSTEM_ACCOUNTS = [
  { code: '1101', name: 'الصندوق والخزينة الرئيسية (Cash)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1102', name: 'الحسابات البنكية للمزرعة (Bank Accounts)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1103', name: 'العملاء ومدينو مبيعات الحليب والماشية (AR)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1104', name: 'مخزون خامات وأعلاف التغذية (Feed Stock)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1105', name: 'مخزون الأدوية واللقاحات البيطرية (Medical Stock)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1201', name: 'الأصول البيولوجية - قطيع الألبان الحلاب (IAS 41 Dairy Herd)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1202', name: 'الأصول البيولوجية - قطيع التسمين واللحم (IAS 41 Beef Cattle)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1203', name: 'الأصول البيولوجية - العجول والمواليد الرضيعة (Calves)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1301', name: 'المحالب الآلية وتجهيزات التبريد (Milking Plants)', category: AccountCategory.ASSET, isLocked: true },
  { code: '1302', name: 'عنابر وحظائر الماشية والمباني (Barns & Buildings)', category: AccountCategory.ASSET, isLocked: true },
  { code: '2101', name: 'الموردون ودائنو الأعلاف والأدوية (AP)', category: AccountCategory.LIABILITY, isLocked: true },
  { code: '2102', name: 'مستحقات ورواتب العمالة الميدانية والبيطرة', category: AccountCategory.LIABILITY, isLocked: true },
  { code: '3101', name: 'رأس مال المزرعة المستثمر (Farm Capital)', category: AccountCategory.EQUITY, isLocked: true },
  { code: '3102', name: 'الأرباح والخسائر المرحلة (Retained Earnings)', category: AccountCategory.EQUITY, isLocked: true },
  { code: '4101', name: 'إيرادات مبيعات الحليب الخام (Raw Milk Sales)', category: AccountCategory.REVENUE, isLocked: true },
  { code: '4102', name: 'إيرادات مبيعات ماشية التسمين واللحوم (Beef Cattle Sales)', category: AccountCategory.REVENUE, isLocked: true },
  { code: '4103', name: 'إيرادات مبيعات الأسمدة العضوية (Organic Fertilizer)', category: AccountCategory.REVENUE, isLocked: true },
  { code: '4201', name: 'مكاسب التغير في القيمة العادلة للأصول البيولوجية (IAS 41 Gain)', category: AccountCategory.REVENUE, isLocked: true },
  { code: '5101', name: 'تكلفة استهلاك الأعلاف والعلائق (Feed Expense)', category: AccountCategory.EXPENSE, isLocked: true },
  { code: '5102', name: 'مصروفات الرعاية والعلاجات البيطرية (Vet & Medical)', category: AccountCategory.EXPENSE, isLocked: true },
  { code: '5103', name: 'أجور ورواتب عمالة المحلب والمزرعة (Farm Labor)', category: AccountCategory.EXPENSE, isLocked: true },
  { code: '5104', name: 'كهرباء وطاقة وتبريد المحالب (Power & Utilities)', category: AccountCategory.EXPENSE, isLocked: true },
  { code: '5105', name: 'خسائر نفوق واستبعاد الماشية (Mortality Loss)', category: AccountCategory.EXPENSE, isLocked: true },
] as const;

@Injectable()
export class AccountingService implements OnModuleInit {
  private readonly logger = new Logger(AccountingService.name);
  private readonly initializedFarms = new Set<string>();
  private readonly initializationTasks = new Map<string, Promise<void>>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_SEED === 'true') {
      await this.seedDefaultChartOfAccountsAndFiscalYear();
      return;
    }

    const farms = await this.prisma.farm.findMany({ select: { id: true } });
    await Promise.all(farms.map(farm => this.ensureAccountingStructure(farm.id)));
  }

  private async ensureAccountingStructure(farmId: string) {
    if (this.initializedFarms.has(farmId)) return;

    const runningTask = this.initializationTasks.get(farmId);
    if (runningTask) return runningTask;

    const task = this.initializeAccountingStructure(farmId)
      .then(() => {
        this.initializedFarms.add(farmId);
      })
      .finally(() => {
        this.initializationTasks.delete(farmId);
      });

    this.initializationTasks.set(farmId, task);
    return task;
  }

  private async initializeAccountingStructure(farmId: string) {
    let fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { farmId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });

    if (!fiscalYear) {
      const year = new Date().getUTCFullYear();
      const yearName = String(year);
      fiscalYear = await this.prisma.fiscalYear.upsert({
        where: { farmId_yearName: { farmId, yearName } },
        update: {},
        create: {
          farmId,
          yearName,
          startDate: new Date(Date.UTC(year, 0, 1)),
          endDate: new Date(Date.UTC(year, 11, 31)),
          status: FiscalStatus.OPEN,
          isCurrent: true,
        },
      });
    }

    const firstPeriodYear = fiscalYear.startDate.getUTCFullYear();
    const firstPeriodMonth = fiscalYear.startDate.getUTCMonth();
    const periods = Array.from({ length: 12 }, (_, index) => {
      const startDate = new Date(Date.UTC(firstPeriodYear, firstPeriodMonth + index, 1));
      const endDate = new Date(Date.UTC(firstPeriodYear, firstPeriodMonth + index + 1, 0));
      return {
        fiscalYearId: fiscalYear.id,
        periodNumber: index + 1,
        periodName: `${ARABIC_MONTH_NAMES[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`,
        startDate,
        endDate,
        status: FiscalStatus.OPEN,
      };
    });

    await Promise.all([
      this.prisma.fiscalPeriod.createMany({ data: periods, skipDuplicates: true }),
      this.prisma.account.createMany({
        data: SYSTEM_ACCOUNTS.map(account => ({
          farmId,
          code: account.code,
          name: account.name,
          category: account.category,
          isSystemLocked: account.isLocked,
          currentBalance: 0,
        })),
        skipDuplicates: true,
      }),
    ]);

    this.logger.log(`تمت تهيئة البنية المحاسبية الإنتاجية للمزرعة ${farmId} دون أرصدة تجريبية`);
  }

  /**
   * زراعة وتجهيز شجرة الحسابات المحاسبية الافتراضية والسنوات المالية لعام 2026
   */
  async seedDefaultChartOfAccountsAndFiscalYear() {
    try {
      const farm = await this.prisma.farm.findFirst();
      if (!farm) return;

      const farmId = farm.id;

      // 1. إنشاء السنة المالية 2026 إذا لم تكن موجودة
      let currentYear = await this.prisma.fiscalYear.findFirst({
        where: { farmId, yearName: '2026' },
      });

      if (!currentYear) {
        this.logger.log('📅 جاري إنشاء السنة المالية الافتراضية 2026 مع 12 فترة شهرية...');
        currentYear = await this.prisma.fiscalYear.create({
          data: {
            farmId,
            yearName: '2026',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            status: FiscalStatus.OPEN,
            isCurrent: true,
          },
        });

        // إنشاء الـ 12 شهراً
        const monthNames = [
          'يناير 2026', 'فبراير 2026', 'مارس 2026', 'أبريل 2026',
          'مايو 2026', 'يونيو 2026', 'يوليو 2026', 'أغسطس 2026',
          'سبتمبر 2026', 'أكتوبر 2026', 'نوفمبر 2026', 'ديسمبر 2026',
        ];

        for (let i = 1; i <= 12; i++) {
          const startMonth = new Date(2026, i - 1, 1);
          const endMonth = new Date(2026, i, 0);
          await this.prisma.fiscalPeriod.create({
            data: {
              fiscalYearId: currentYear.id,
              periodNumber: i,
              periodName: monthNames[i - 1],
              startDate: startMonth,
              endDate: endMonth,
              status: FiscalStatus.OPEN,
            },
          });
        }
      }

      // 2. فحص شجرة الحسابات
      const accountsCount = await this.prisma.account.count({ where: { farmId } });
      if (accountsCount > 0) return;

      this.logger.log('📊 جاري بناء شجرة الحسابات المالية للمزرعة وفق معيار IAS 41 للأصول البيولوجية...');

      const defaultAccounts = [
        // 1. الأصول (Assets)
        { code: '1101', name: 'الصندوق والخزينة الرئيسية (Cash)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1102', name: 'الحسابات البنكية للمزرعة (Bank Accounts)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1103', name: 'العملاء ومدينو مبيعات الحليب والماشية (AR)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1104', name: 'مخزون خامات وأعلاف التغذية (Feed Stock)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1105', name: 'مخزون الأدوية واللقاحات البيطرية (Medical Stock)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1201', name: 'الأصول البيولوجية - قطيع الألبان الحلاب (IAS 41 Dairy Herd)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1202', name: 'الأصول البيولوجية - قطيع التسمين واللحم (IAS 41 Beef Cattle)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1203', name: 'الأصول البيولوجية - العجول والمواليد الرضيعة (Calves)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1301', name: 'المحالب الآلية وتجهيزات التبريد (Milking Plants)', category: AccountCategory.ASSET, isLocked: true },
        { code: '1302', name: 'عنابر وحظائر الماشية والمباني (Barns & Buildings)', category: AccountCategory.ASSET, isLocked: true },

        // 2. الخصوم والالتزامات (Liabilities)
        { code: '2101', name: 'الموردون ودائنو الأعلاف والأدوية (AP)', category: AccountCategory.LIABILITY, isLocked: true },
        { code: '2102', name: 'مستحقات ورواتب العمالة الميدانية والبيطرة', category: AccountCategory.LIABILITY, isLocked: true },

        // 3. حقوق الملكية (Equity)
        { code: '3101', name: 'رأس مال المزرعة المستثمر (Farm Capital)', category: AccountCategory.EQUITY, isLocked: true },
        { code: '3102', name: 'الأرباح والخسائر المرحلة (Retained Earnings)', category: AccountCategory.EQUITY, isLocked: true },

        // 4. الإيرادات (Revenues)
        { code: '4101', name: 'إيرادات مبيعات الحليب الخام (Raw Milk Sales)', category: AccountCategory.REVENUE, isLocked: true },
        { code: '4102', name: 'إيرادات مبيعات ماشية التسمين واللحوم (Beef Cattle Sales)', category: AccountCategory.REVENUE, isLocked: true },
        { code: '4103', name: 'إيرادات مبيعات الأسمدة العضوية (Organic Fertilizer)', category: AccountCategory.REVENUE, isLocked: true },
        { code: '4201', name: 'مكاسب التغير في القيمة العادلة للأصول البيولوجية (IAS 41 Gain)', category: AccountCategory.REVENUE, isLocked: true },

        // 5. المصروفات التشغيلية (Expenses)
        { code: '5101', name: 'تكلفة استهلاك الأعلاف والعلائق (Feed Expense)', category: AccountCategory.EXPENSE, isLocked: true },
        { code: '5102', name: 'مصروفات الرعاية والعلاجات البيطرية (Vet & Medical)', category: AccountCategory.EXPENSE, isLocked: true },
        { code: '5103', name: 'أجور ورواتب عمالة المحلب والمزرعة (Farm Labor)', category: AccountCategory.EXPENSE, isLocked: true },
        { code: '5104', name: 'كهرباء وطاقة وتبريد المحالب (Power & Utilities)', category: AccountCategory.EXPENSE, isLocked: true },
        { code: '5105', name: 'خسائر نفوق واستبعاد الماشية (Mortality Loss)', category: AccountCategory.EXPENSE, isLocked: true },
      ];

      for (const acc of defaultAccounts) {
        await this.prisma.account.create({
          data: {
            farmId,
            code: acc.code,
            name: acc.name,
            category: acc.category,
            isSystemLocked: acc.isLocked,
            currentBalance: 0,
          },
        });
      }

      // 3. إنشاء قيد افتتاحي متوازن (Opening Balance Journal Entry)
      const accCash = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1101' } } });
      const accDairy = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1201' } } });
      const accBeef = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1202' } } });
      const accFeed = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1104' } } });
      const accCapital = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '3101' } } });

      if (accCash && accDairy && accBeef && accFeed && accCapital) {
        const openingEntry = await this.prisma.journalEntry.create({
          data: {
            farmId,
            fiscalYearId: currentYear.id,
            entryNumber: 'JV-2026-0001',
            entryDate: new Date('2026-01-01'),
            type: JournalEntryType.OPENING_BALANCE,
            status: JournalEntryStatus.POSTED,
            description: 'القيد الافتتاحي لأصول وقطيع المزرعة لعام 2026 (IAS 41)',
            totalDebit: 1350000,
            totalCredit: 1350000,
            postedAt: new Date(),
            postedBy: 'النظام المحاسبي الآلي',
            lines: {
              create: [
                { accountId: accCash.id, debit: 250000, credit: 0, memo: 'رصيد الخزينة الافتتاحي' },
                { accountId: accDairy.id, debit: 650000, credit: 0, memo: 'قيمة قطيع الألبان (185 بقرة حلابة)' },
                { accountId: accBeef.id, debit: 320000, credit: 0, memo: 'قيمة قطيع التسمين (140 رأس)' },
                { accountId: accFeed.id, debit: 130000, credit: 0, memo: 'رصيد مخازن الأعلاف الافتتاحي' },
                { accountId: accCapital.id, debit: 0, credit: 1350000, memo: 'رأس مال المزرعة الافتتاحي' },
              ],
            },
          },
        });

        // تحديث أرصدة الحسابات الافتتاحية
        await this.prisma.account.update({ where: { id: accCash.id }, data: { currentBalance: 250000 } });
        await this.prisma.account.update({ where: { id: accDairy.id }, data: { currentBalance: 650000 } });
        await this.prisma.account.update({ where: { id: accBeef.id }, data: { currentBalance: 320000 } });
        await this.prisma.account.update({ where: { id: accFeed.id }, data: { currentBalance: 130000 } });
        await this.prisma.account.update({ where: { id: accCapital.id }, data: { currentBalance: -1350000 } });
      }

      this.logger.log('✅ تم تجهيز شجرة الحسابات والقيد الافتتاحي بنجاح.');
    } catch (e: any) {
      this.logger.warn(`تعذر زراعة شجرة الحسابات: ${e.message}`);
    }
  }

  /**
   * جلب شجرة الحسابات
   */
  async getChartOfAccounts(farmId: string) {
    await this.ensureAccountingStructure(farmId);
    return this.prisma.account.findMany({
      where: { farmId },
      orderBy: { code: 'asc' },
      include: {
        children: true,
      },
    });
  }

  /**
   * إضافة حساب جديد لشجرة الحسابات
   */
  async createAccount(dto: CreateAccountDto, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    await this.ensureAccountingStructure(farmId);
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      if (dto.parentId) {
        const parent = await tx.account.findFirst({ where: { id: dto.parentId, farmId } });
        if (!parent) throw new NotFoundException('الحساب الأب غير موجود في مزرعة المستخدم');
      }
      const existing = await tx.account.findUnique({
        where: { farmId_code: { farmId, code: dto.code } },
      });
      if (existing) throw new BadRequestException(`رقم الحساب (${dto.code}) مسجل مسبقاً`);

      const account = await tx.account.create({
        data: {
          farmId,
          code: dto.code,
          name: dto.name,
          nameEn: dto.nameEn,
          category: dto.category,
          parentId: dto.parentId,
          currentBalance: 0,
        },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.account.created',
        entityType: 'account',
        entityId: account.id,
        farmId,
        metadata: { code: account.code, category: account.category },
      });
      return account;
    }, this.serializableOptions());
  }

  /**
   * جلب السنوات المالية
   */
  async getFiscalYears(farmId: string) {
    await this.ensureAccountingStructure(farmId);
    return this.prisma.fiscalYear.findMany({
      where: { farmId },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
        },
      },
      orderBy: { yearName: 'desc' },
    });
  }

  /**
   * إنشاء قيد يومية جديد مع التحقق الصارم من التوازن (Debit = Credit)
   */
  async createJournalEntry(
    dto: CreateJournalEntryDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    await this.ensureAccountingStructure(farmId);
    if (!dto.lines?.length) throw new BadRequestException('يجب أن يحتوي القيد على سطرين محاسبيين على الأقل');
    // 1. التحقق من التوازن الحسابي للقيد
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of dto.lines) {
      if ((line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0)) {
        throw new BadRequestException('كل سطر محاسبي يجب أن يحتوي مبلغاً في جانب المدين أو الدائن فقط');
      }
      totalDebit = totalDebit.plus(line.debit || 0);
      totalCredit = totalCredit.plus(line.credit || 0);
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `القيد غير متوازن! إجمالي المدين (${totalDebit.toFixed(3)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(3)})`
      );
    }

    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      let fiscalYearId = dto.fiscalYearId;
      if (!fiscalYearId) {
        const activeYear = await tx.fiscalYear.findFirst({
          where: { farmId, status: FiscalStatus.OPEN, isCurrent: true },
          select: { id: true },
        });
        fiscalYearId = activeYear?.id;
      }
      if (!fiscalYearId) throw new BadRequestException('لا توجد سنة مالية مفتوحة لتسجيل القيد');

      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { id: fiscalYearId, farmId, status: FiscalStatus.OPEN },
        select: { id: true, yearName: true, startDate: true, endDate: true },
      });
      if (!fiscalYear) throw new NotFoundException('السنة المالية غير موجودة أو غير مفتوحة في مزرعة المستخدم');

      const entryDate = new Date(dto.entryDate);
      if (entryDate < fiscalYear.startDate || entryDate > fiscalYear.endDate) {
        throw new BadRequestException('تاريخ القيد خارج نطاق السنة المالية المحددة');
      }

      const period = await tx.fiscalPeriod.findFirst({
        where: dto.fiscalPeriodId
          ? { id: dto.fiscalPeriodId, fiscalYearId, fiscalYear: { farmId }, status: FiscalStatus.OPEN }
          : { fiscalYearId, status: FiscalStatus.OPEN, startDate: { lte: entryDate }, endDate: { gte: entryDate } },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!period) throw new BadRequestException('لا توجد فترة مالية مفتوحة توافق تاريخ القيد');
      if (entryDate < period.startDate || entryDate > period.endDate) {
        throw new BadRequestException('تاريخ القيد خارج نطاق الفترة المالية المحددة');
      }

      const accountIds = [...new Set(dto.lines.map(line => line.accountId))];
      const ownedAccounts = await tx.account.count({ where: { id: { in: accountIds }, farmId, isActive: true } });
      if (ownedAccounts !== accountIds.length) throw new NotFoundException('يتضمن القيد حساباً غير موجود أو غير نشط في مزرعة المستخدم');

      const costCenterIds = [...new Set(dto.lines.map(line => line.costCenterId).filter((id): id is string => Boolean(id)))];
      if (costCenterIds.length) {
        const ownedCostCenters = await tx.costCenter.count({ where: { id: { in: costCenterIds }, farmId } });
        if (ownedCostCenters !== costCenterIds.length) throw new NotFoundException('يتضمن القيد مركز تكلفة غير موجود في مزرعة المستخدم');
      }

      const entryNumber = await this.nextEntryNumber(tx, farmId, fiscalYear.id, fiscalYear.yearName);
      for (const line of dto.lines.filter(line => line.animalId)) {
        const animal = await tx.animal.findFirst({ where: { id: line.animalId, farmId, status: { notIn: ['SOLD', 'DECEASED'] } } });
        const account = await tx.account.findFirst({ where: { id: line.accountId, farmId, code: { in: ['1201', '1202', '1203'] } } });
        if (!animal || !account) throw new BadRequestException('ربط الحيوان يتطلب حيواناً غير مستبعد وحساب أصل بيولوجي من المزرعة نفسها');
      }
      const entry = await tx.journalEntry.create({
        data: {
          farmId,
          fiscalYearId,
          fiscalPeriodId: period.id,
          entryNumber,
          entryDate,
          type: dto.type || JournalEntryType.MANUAL,
          status: JournalEntryStatus.POSTED,
          description: dto.description,
          referenceId: dto.referenceId,
          totalDebit: totalDebit.toNumber(),
          totalCredit: totalCredit.toNumber(),
          postedAt: new Date(),
          postedBy: actor?.id ?? 'system',
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              costCenterId: l.costCenterId,
              animalId: l.animalId,
              debit: l.debit || 0,
              credit: l.credit || 0,
              memo: l.memo,
            })),
          },
        },
        include: {
          lines: { include: { account: true, costCenter: true } },
        },
      });

      // تحديث أرصدة الحسابات في الدفتر العام
      for (const line of dto.lines) {
        const netChange = new Decimal(line.debit || 0).minus(line.credit || 0);
        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: netChange.toNumber(),
            },
          },
        });
      }

      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.journal.posted',
        entityType: 'journalEntry',
        entityId: entry.id,
        farmId,
        metadata: { entryNumber, fiscalYearId, totalDebit: totalDebit.toFixed(3) },
      });

      return entry;
    }, this.serializableOptions());
  }

  /**
   * جلب سجل قيود اليومية
   */
  async getJournalEntries(farmId: string, limit = 50) {
    await this.ensureAccountingStructure(farmId);
    return this.prisma.journalEntry.findMany({
      where: { farmId },
      include: {
        lines: {
          include: {
            account: true,
            costCenter: true,
          },
        },
        fiscalYear: true,
      },
      orderBy: { entryDate: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  /**
   * استخراج ميزان المراجعة (Trial Balance) بالمجاميع والأرصدة
   */
  async getTrialBalance(farmId: string, fiscalYearId?: string) {
    return this.buildTrialBalance(farmId, fiscalYearId);
  }

  private async buildTrialBalance(farmId: string, fiscalYearId?: string, excludeClosing = false) {
    const fiscalYear = await this.resolveReportingYear(farmId, fiscalYearId);
    const [accounts, aggregates] = await Promise.all([
      this.getChartOfAccounts(farmId),
      this.prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: {
            farmId, fiscalYearId: fiscalYear.id, status: JournalEntryStatus.POSTED,
            ...(excludeClosing ? { type: { not: JournalEntryType.YEAR_END_CLOSING } } : {}),
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);
    const totalsByAccount = new Map(aggregates.map(item => [item.accountId, item._sum]));

    let totalDebitSum = new Decimal(0);
    let totalCreditSum = new Decimal(0);

    const rows = accounts.map((acc) => {
      const aggregate = totalsByAccount.get(acc.id);
      const debitTotal = new Decimal(aggregate?.debit ?? 0);
      const creditTotal = new Decimal(aggregate?.credit ?? 0);

      totalDebitSum = totalDebitSum.plus(debitTotal);
      totalCreditSum = totalCreditSum.plus(creditTotal);

      const netBalance = debitTotal.minus(creditTotal);

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        totalDebit: debitTotal.toNumber(),
        totalCredit: creditTotal.toNumber(),
        netDebit: netBalance.greaterThan(0) ? netBalance.toNumber() : 0,
        netCredit: netBalance.lessThan(0) ? netBalance.abs().toNumber() : 0,
      };
    });

    const now = new Date();
    const asOfDate = now < fiscalYear.startDate
      ? fiscalYear.startDate
      : now > fiscalYear.endDate ? fiscalYear.endDate : now;

    return {
      fiscalYear: { id: fiscalYear.id, yearName: fiscalYear.yearName, status: fiscalYear.status },
      asOfDate: asOfDate.toISOString().split('T')[0],
      isBalanced: totalDebitSum.equals(totalCreditSum),
      totalDebits: totalDebitSum.toNumber(),
      totalCredits: totalCreditSum.toNumber(),
      accounts: rows,
    };
  }

  /**
   * استخراج قائمة الدخل الزراعية (Farm Income Statement - P&L)
   */
  async getIncomeStatement(farmId: string, fiscalYearId?: string) {
    return this.buildIncomeStatement(await this.buildTrialBalance(farmId, fiscalYearId, true));
  }

  /**
   * استخراج الميزانية العمومية والمركز المالي (Balance Sheet)
   */
  async getBalanceSheet(farmId: string, fiscalYearId?: string) {
    const trialBalance = await this.getTrialBalance(farmId, fiscalYearId);
    const incomeStatement = this.buildIncomeStatement(trialBalance);

    const assets = trialBalance.accounts.filter((a) => a.category === AccountCategory.ASSET);
    const liabilities = trialBalance.accounts.filter((a) => a.category === AccountCategory.LIABILITY);
    const equity = trialBalance.accounts.filter((a) => a.category === AccountCategory.EQUITY);

    const totalAssets = assets.reduce((acc, a) => Money.add(acc, Money.sub(a.netDebit, a.netCredit)), 0);
    const totalLiabilities = liabilities.reduce((acc, l) => Money.add(acc, Money.sub(l.netCredit, l.netDebit)), 0);
    const totalEquity = Money.add(equity.reduce((acc, e) => Money.add(acc, Money.sub(e.netCredit, e.netDebit)), 0), incomeStatement.netProfit);

    return {
      fiscalYear: trialBalance.fiscalYear,
      asOfDate: trialBalance.asOfDate,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Money.isZero(Money.sub(totalAssets, Money.add(totalLiabilities, totalEquity))),
      assets,
      liabilities,
      equity,
    };
  }

  /**
   * إقفال فترة شهرية
   */
  async closePeriod(periodId: string, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, fiscalYear: { farmId } },
        select: { status: true, fiscalYear: { select: { status: true } } },
      });
      if (!period) throw new NotFoundException('الفترة المالية غير موجودة في مزرعة المستخدم');
      if (period.status !== FiscalStatus.OPEN || period.fiscalYear.status !== FiscalStatus.OPEN) {
        throw new BadRequestException('الفترة مقفلة أو تتبع سنة مالية مقفلة');
      }
      const updated = await tx.fiscalPeriod.updateMany({
        where: { id: periodId, status: FiscalStatus.OPEN, fiscalYear: { farmId, status: FiscalStatus.OPEN } },
        data: { status: FiscalStatus.CLOSED, closedAt: new Date() },
      });
      if (!updated.count) throw new BadRequestException('الفترة غير موجودة أو مقفلة أو تتبع سنة مالية مقفلة');
      const result = await tx.fiscalPeriod.findUnique({ where: { id: periodId } });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.period.closed', entityType: 'fiscalPeriod', entityId: periodId, farmId,
      });
      return result;
    }, this.serializableOptions());
  }

  /**
   * إعادة فتح فترة شهرية
   */
  async reopenPeriod(periodId: string, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, fiscalYear: { farmId } },
        select: { status: true, fiscalYear: { select: { status: true } } },
      });
      if (!period) throw new NotFoundException('الفترة المالية غير موجودة في مزرعة المستخدم');
      if (period.status !== FiscalStatus.CLOSED || period.fiscalYear.status !== FiscalStatus.OPEN) {
        throw new BadRequestException('لا يمكن إعادة فتح الفترة؛ يجب أن تكون الفترة مقفلة والسنة المالية مفتوحة');
      }
      const updated = await tx.fiscalPeriod.updateMany({
        where: { id: periodId, status: FiscalStatus.CLOSED, fiscalYear: { farmId, status: FiscalStatus.OPEN } },
        data: { status: FiscalStatus.OPEN, closedAt: null },
      });
      if (!updated.count) throw new BadRequestException('لا يمكن إعادة فتح الفترة؛ تحقق من ملكيتها ومن أن السنة المالية ما زالت مفتوحة');
      const result = await tx.fiscalPeriod.findUnique({ where: { id: periodId } });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.period.reopened', entityType: 'fiscalPeriod', entityId: periodId, farmId,
      });
      return result;
    }, this.serializableOptions());
  }

  /**
   * إنشاء وفتح سنة مالية جديدة
   */
  async createFiscalYear(
    dto: CreateFiscalYearDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate >= endDate) throw new BadRequestException('تاريخ نهاية السنة المالية يجب أن يلي تاريخ بدايتها');
    if (startDate.getUTCFullYear() !== Number(dto.yearName) || endDate.getUTCFullYear() !== Number(dto.yearName)) {
      throw new BadRequestException('تواريخ السنة المالية يجب أن تقع داخل السنة المحددة');
    }

    const startY = startDate.getUTCFullYear();
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const existing = await tx.fiscalYear.findUnique({
        where: { farmId_yearName: { farmId, yearName: dto.yearName } },
      });
      if (existing) {
        throw new BadRequestException(`السنة المالية (${dto.yearName}) موجودة مسبقاً`);
      }

      await tx.fiscalYear.updateMany({
        where: { farmId, isCurrent: true },
        data: { isCurrent: false },
      });

      const fiscalYear = await tx.fiscalYear.create({
        data: {
          farmId,
          yearName: dto.yearName,
          startDate,
          endDate,
          status: FiscalStatus.OPEN,
          isCurrent: true,
          periods: { create: this.buildFiscalPeriods(startY) },
        },
        include: { periods: { orderBy: { periodNumber: 'asc' } } },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.fiscal-year.created',
        entityType: 'fiscalYear',
        entityId: fiscalYear.id,
        farmId,
        metadata: { yearName: dto.yearName },
      });
      return fiscalYear;
    }, this.serializableOptions());
  }

  /**
   * إقفال السنة المالية الحالية وترحيل الأرصدة الختامية تلقائياً إلى السنة المالية الجديدة
   */
  async rolloverFiscalYear(
    currentYearId: string,
    nextYearName: string,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    const nextYearNumber = Number(nextYearName);
    const closedBy = actor?.id ?? 'system';

    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const currentYear = await tx.fiscalYear.findFirst({
        where: { id: currentYearId, farmId, status: FiscalStatus.OPEN },
      });
      if (!currentYear) throw new NotFoundException('السنة المالية الحالية غير موجودة أو مقفلة مسبقاً');
      if (nextYearNumber <= Number(currentYear.yearName)) {
        throw new BadRequestException('السنة المالية التالية يجب أن تكون أحدث من السنة الحالية');
      }

      const closing = await this.buildYearEndClosing(tx, farmId, currentYear.id);
      const netProfit = closing.netProfit;
      const retainedEarnings = await tx.account.findUnique({
        where: { farmId_code: { farmId, code: '3102' } },
      });
      if (netProfit !== 0 && !retainedEarnings) {
        throw new BadRequestException('حساب الأرباح المرحلة (3102) غير موجود؛ لا يمكن إقفال السنة');
      }

      if (retainedEarnings && netProfit !== 0) {
        closing.lines.push(netProfit > 0
          ? { accountId: retainedEarnings.id, debit: 0, credit: netProfit, memo: `ترحيل صافي ربح ${currentYear.yearName}` }
          : { accountId: retainedEarnings.id, debit: Math.abs(netProfit), credit: 0, memo: `ترحيل صافي خسارة ${currentYear.yearName}` });
      }

      if (closing.lines.length) {
        const closingPeriod = await tx.fiscalPeriod.findFirst({
          where: { fiscalYearId: currentYear.id, status: FiscalStatus.OPEN },
          orderBy: { periodNumber: 'desc' },
          select: { id: true },
        });
        if (!closingPeriod) throw new BadRequestException('يجب إعادة فتح الفترة الختامية قبل إقفال السنة');

        const closingDebit = closing.lines.reduce((total, line) => total.plus(line.debit), new Decimal(0));
        const closingCredit = closing.lines.reduce((total, line) => total.plus(line.credit), new Decimal(0));
        if (!closingDebit.equals(closingCredit)) {
          throw new BadRequestException('تعذر إنشاء قيد الإقفال لأن سطوره غير متوازنة');
        }

        const entryNumber = await this.nextEntryNumber(tx, farmId, currentYear.id, currentYear.yearName);
        await tx.journalEntry.create({
          data: {
            farmId,
            fiscalYearId: currentYear.id,
            fiscalPeriodId: closingPeriod.id,
            entryNumber,
            entryDate: currentYear.endDate,
            type: JournalEntryType.YEAR_END_CLOSING,
            status: JournalEntryStatus.POSTED,
            description: `قيد إقفال الإيرادات والمصروفات للسنة المالية ${currentYear.yearName}`,
            referenceId: `YEAR_CLOSING:${currentYear.id}`,
            totalDebit: closingDebit.toNumber(),
            totalCredit: closingCredit.toNumber(),
            postedAt: new Date(),
            postedBy: closedBy,
            lines: { create: closing.lines },
          },
        });
        for (const line of closing.lines) {
          await tx.account.update({
            where: { id: line.accountId },
            data: { currentBalance: { increment: new Decimal(line.debit).minus(line.credit).toNumber() } },
          });
        }
      }

      const closedAt = new Date();
      await tx.fiscalPeriod.updateMany({
        where: { fiscalYearId: currentYear.id },
        data: { status: FiscalStatus.CLOSED, closedAt },
      });
      await tx.fiscalYear.updateMany({
        where: { farmId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.fiscalYear.update({
        where: { id: currentYear.id },
        data: { status: FiscalStatus.CLOSED, closedAt, closedBy, isCurrent: false },
      });

      const nextYearNameNormalized = String(nextYearNumber);
      const startDate = new Date(Date.UTC(nextYearNumber, 0, 1));
      const endDate = new Date(Date.UTC(nextYearNumber, 11, 31));
      let nextYear = await tx.fiscalYear.findUnique({
        where: { farmId_yearName: { farmId, yearName: nextYearNameNormalized } },
      });

      if (nextYear?.status === FiscalStatus.CLOSED) {
        throw new BadRequestException('السنة المالية التالية موجودة لكنها مقفلة ولا يمكن إعادة فتحها ضمن الترحيل');
      }
      if (!nextYear) {
        nextYear = await tx.fiscalYear.create({
          data: {
            farmId,
            yearName: nextYearNameNormalized,
            startDate,
            endDate,
            status: FiscalStatus.OPEN,
            isCurrent: true,
            periods: { create: this.buildFiscalPeriods(nextYearNumber) },
          },
        });
      } else {
        nextYear = await tx.fiscalYear.update({
          where: { id: nextYear.id },
          data: { isCurrent: true },
        });
      }

      const accounts = await tx.account.findMany({
        where: {
          farmId,
          isActive: true,
          category: { in: [AccountCategory.ASSET, AccountCategory.LIABILITY, AccountCategory.EQUITY] },
        },
      });
      const openingLines: Array<{ accountId: string; debit: number; credit: number; memo: string }> = [];
      // The source year's ledger (including its closing entry) is authoritative.
      // A lifetime account cache can already contain transactions from the next year.
      const sourceTotals = await tx.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { journalEntry: { farmId, fiscalYearId: currentYear.id, status: JournalEntryStatus.POSTED } },
        _sum: { debit: true, credit: true },
      });
      const sourceByAccount = new Map(sourceTotals.map(row => [row.accountId, row._sum]));
      let totalDebit = new Decimal(0);
      let totalCredit = new Decimal(0);

      for (const account of accounts) {
        const source = sourceByAccount.get(account.id);
        const balance = new Decimal(source?.debit ?? 0).minus(source?.credit ?? 0);
        if (balance.isZero()) continue;
        if (balance.greaterThan(0)) {
          openingLines.push({ accountId: account.id, debit: balance.toNumber(), credit: 0, memo: `رصيد مرحل من ${currentYear.yearName}` });
          totalDebit = totalDebit.plus(balance);
        } else {
          openingLines.push({ accountId: account.id, debit: 0, credit: balance.abs().toNumber(), memo: `رصيد مرحل من ${currentYear.yearName}` });
          totalCredit = totalCredit.plus(balance.abs());
        }
      }

      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `تعذر الترحيل لأن أرصدة الميزانية غير متوازنة: مدين ${totalDebit.toFixed(3)} ودائن ${totalCredit.toFixed(3)}`,
        );
      }

      if (openingLines.length > 0) {
        const openingPeriod = await tx.fiscalPeriod.findFirst({
          where: { fiscalYearId: nextYear.id, status: FiscalStatus.OPEN, periodNumber: 1 },
          select: { id: true },
        });
        if (!openingPeriod) throw new BadRequestException('الفترة الافتتاحية للسنة التالية غير موجودة أو غير مفتوحة');
        const entryNumber = await this.nextEntryNumber(tx, farmId, nextYear.id, nextYear.yearName);
        await tx.journalEntry.create({
          data: {
            farmId,
            fiscalYearId: nextYear.id,
            fiscalPeriodId: openingPeriod.id,
            entryNumber,
            entryDate: startDate,
            type: JournalEntryType.OPENING_BALANCE,
            status: JournalEntryStatus.POSTED,
            description: `القيد الافتتاحي المرحل من السنة المالية ${currentYear.yearName}`,
            referenceId: `YEAR_ROLLOVER:${currentYear.id}`,
            totalDebit: totalDebit.toNumber(),
            totalCredit: totalCredit.toNumber(),
            postedAt: new Date(),
            postedBy: closedBy,
            lines: { create: openingLines },
          },
        });
      }

      if (actor) await appendDomainAudit(tx, actor, {
        action: 'accounting.fiscal-year.rolled-over',
        entityType: 'fiscalYear',
        entityId: currentYear.id,
        farmId,
        metadata: { fromYear: currentYear.yearName, toYear: nextYear.yearName, netProfit },
      });

      return {
        success: true,
        message: `تم إقفال السنة ${currentYear.yearName} وترحيل الأرصدة إلى ${nextYear.yearName}`,
        closedYear: currentYear.yearName,
        newYear: nextYear.yearName,
        netProfitTransferred: netProfit,
      };
    }, this.serializableOptions());
  }

  private buildFiscalPeriods(year: number) {
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return monthNames.map((monthName, index) => ({
      periodNumber: index + 1,
      periodName: `${monthName} ${year}`,
      startDate: new Date(Date.UTC(year, index, 1)),
      endDate: new Date(Date.UTC(year, index + 1, 0)),
      status: FiscalStatus.OPEN,
    }));
  }

  private async resolveReportingYear(farmId: string, fiscalYearId?: string) {
    await this.ensureAccountingStructure(farmId);
    const fiscalYear = fiscalYearId
      ? await this.prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, farmId } })
      : await this.prisma.fiscalYear.findFirst({
          where: { farmId },
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        });
    if (!fiscalYear) throw new NotFoundException('لا توجد سنة مالية متاحة للتقرير في مزرعة المستخدم');
    return fiscalYear;
  }

  private buildIncomeStatement(trialBalance: Awaited<ReturnType<AccountingService['getTrialBalance']>>) {
    const revenues = trialBalance.accounts.filter(account => account.category === AccountCategory.REVENUE);
    const expenses = trialBalance.accounts.filter(account => account.category === AccountCategory.EXPENSE);
    const totalRevenue = revenues.reduce(
      (total, account) => total.plus(account.netCredit).minus(account.netDebit),
      new Decimal(0),
    );
    const totalExpenses = expenses.reduce(
      (total, account) => total.plus(account.netDebit).minus(account.netCredit),
      new Decimal(0),
    );
    const netProfit = totalRevenue.minus(totalExpenses);

    return {
      fiscalYear: trialBalance.fiscalYear,
      period: `السنة المالية ${trialBalance.fiscalYear.yearName}`,
      totalRevenue: totalRevenue.toNumber(),
      totalExpenses: totalExpenses.toNumber(),
      netProfit: netProfit.toNumber(),
      profitMarginPct: totalRevenue.greaterThan(0)
        ? netProfit.dividedBy(totalRevenue).times(100).toDecimalPlaces(1).toNumber()
        : 0,
      revenues,
      expenses,
    };
  }

  private async buildYearEndClosing(tx: Prisma.TransactionClient, farmId: string, fiscalYearId: string) {
    const accounts = await tx.account.findMany({
      where: { farmId, category: { in: [AccountCategory.REVENUE, AccountCategory.EXPENSE] } },
      select: { id: true, code: true, category: true },
    });
    const aggregates = await tx.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accounts.map(account => account.id) },
        journalEntry: { farmId, fiscalYearId, status: JournalEntryStatus.POSTED },
      },
      _sum: { debit: true, credit: true },
    });
    const totalsByAccount = new Map(aggregates.map(item => [item.accountId, item._sum]));
    const lines: Array<{ accountId: string; debit: number; credit: number; memo: string }> = [];
    let revenue = new Decimal(0);
    let expense = new Decimal(0);

    for (const account of accounts) {
      const total = totalsByAccount.get(account.id);
      const debit = new Decimal(total?.debit ?? 0);
      const credit = new Decimal(total?.credit ?? 0);
      const normalBalance = account.category === AccountCategory.REVENUE
        ? credit.minus(debit)
        : debit.minus(credit);
      if (normalBalance.isZero()) continue;

      if (account.category === AccountCategory.REVENUE) {
        revenue = revenue.plus(normalBalance);
        lines.push(normalBalance.greaterThan(0)
          ? { accountId: account.id, debit: normalBalance.toNumber(), credit: 0, memo: `إقفال حساب الإيراد ${account.code}` }
          : { accountId: account.id, debit: 0, credit: normalBalance.abs().toNumber(), memo: `إقفال حساب الإيراد ${account.code}` });
      } else {
        expense = expense.plus(normalBalance);
        lines.push(normalBalance.greaterThan(0)
          ? { accountId: account.id, debit: 0, credit: normalBalance.toNumber(), memo: `إقفال حساب المصروف ${account.code}` }
          : { accountId: account.id, debit: normalBalance.abs().toNumber(), credit: 0, memo: `إقفال حساب المصروف ${account.code}` });
      }
    }

    return { lines, netProfit: revenue.minus(expense).toNumber() };
  }

  private async nextEntryNumber(tx: Prisma.TransactionClient, farmId: string, fiscalYearId: string, yearName: string) {
    const sequence = await tx.journalSequence.findUnique({
      where: { farmId_fiscalYearId: { farmId, fiscalYearId } },
    });

    let assignedNumber: number;
    if (sequence) {
      const updated = await tx.journalSequence.update({
        where: { id: sequence.id },
        data: { nextNumber: { increment: 1 } },
      });
      assignedNumber = updated.nextNumber - 1;
    } else {
      const prefix = `JV-${yearName}-`;
      const latestEntry = await tx.journalEntry.findFirst({
        where: { farmId, fiscalYearId, entryNumber: { startsWith: prefix } },
        select: { entryNumber: true },
        orderBy: { entryNumber: 'desc' },
      });
      const lastNumber = latestEntry ? Number(latestEntry.entryNumber.slice(prefix.length)) || 0 : 0;
      assignedNumber = lastNumber + 1;
      await tx.journalSequence.create({
        data: { farmId, fiscalYearId, nextNumber: assignedNumber + 1 },
      });
    }

    return `JV-${yearName}-${String(assignedNumber).padStart(6, '0')}`;
  }

  private serializableOptions() {
    return {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxRetries: 2,
      timeoutMs: 30_000,
    };
  }

  /**
   * تسجيل قيد آلي لمبيعات / إنتاج الحليب اليومي (Raw Milk Sales)
   */
  async recordMilkSalesJournalEntry(farmId: string, liters: number, pricePerLiter = 3.5, memo = 'مبيعات حليب يومية') {
    const total = Number((liters * pricePerLiter).toFixed(3));
    if (total <= 0) return null;

    const accCash = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1101' } } });
    const accMilkRev = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '4101' } } });

    if (!accCash || !accMilkRev) return null;

    const currentYear = await this.prisma.fiscalYear.findFirst({
      where: { farmId, isCurrent: true, status: FiscalStatus.OPEN },
    });
    if (!currentYear) return null;

    return this.createJournalEntry({
      fiscalYearId: currentYear.id,
      entryDate: new Date().toISOString().split('T')[0],
      type: JournalEntryType.MILK_SALE,
      description: `${memo} (${liters} لتر بسعر ${pricePerLiter} د.ل/لتر)`,
      lines: [
        { accountId: accCash.id, debit: total, credit: 0, memo: 'إيداع نقدي / خزان الحليب' },
        { accountId: accMilkRev.id, debit: 0, credit: total, memo: 'إيراد مبيعات حليب خام' },
      ],
    }, farmId);
  }

  /**
   * تسجيل قيد آلي لصرف الأعلاف للحظائر (Feed Dispense Expense)
   */
  async recordFeedDispenseJournalEntry(farmId: string, barnName: string, costAmount: number, formulaName = 'عليقة TMR') {
    if (costAmount <= 0) return null;

    const accFeedExp = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '5101' } } });
    const accFeedStock = await this.prisma.account.findUnique({ where: { farmId_code: { farmId, code: '1104' } } });

    if (!accFeedExp || !accFeedStock) return null;

    const currentYear = await this.prisma.fiscalYear.findFirst({
      where: { farmId, isCurrent: true, status: FiscalStatus.OPEN },
    });
    if (!currentYear) return null;

    return this.createJournalEntry({
      fiscalYearId: currentYear.id,
      entryDate: new Date().toISOString().split('T')[0],
      type: JournalEntryType.FEED_DISPENSE,
      description: `صرف خلطة (${formulaName}) لحساب (${barnName})`,
      lines: [
        { accountId: accFeedExp.id, debit: costAmount, credit: 0, memo: `مصروف تغذية - ${barnName}` },
        { accountId: accFeedStock.id, debit: 0, credit: costAmount, memo: 'صرف من مخزون الأعلاف' },
      ],
    }, farmId);
  }
}

