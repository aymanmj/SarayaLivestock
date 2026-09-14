import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AnimalPricingMethod,
  AnimalStatus,
  FiscalStatus,
  JournalEntryStatus,
  JournalEntryType,
  PaymentMethod,
  Prisma,
  Purpose,
  SaleType,
  Species,
} from '@prisma/client';
import { RecordMilkSaleDto, RecordAnimalSaleDto, RecordMortalityDto } from './dto/sales.dto';
import { Decimal } from 'decimal.js';
import { Money } from '../../common/utils/money.util';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * تسجيل عملية بيع حليب خام مع إنشاء القيد المحاسبي المزدوج آلياً
   */
  async recordMilkSale(
    dto: RecordMilkSaleDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    const totalAmount = Money.round(new Decimal(dto.liters).times(dto.pricePerLiter).toNumber());
    if (totalAmount <= 0) {
      throw new BadRequestException('إجمالي فاتورة الحليب يجب أن يكون أكبر من صفر');
    }

    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const { fiscalYear, fiscalPeriod } = await this.resolveOpenFiscalPeriod(tx, farmId);

      // تحديد حساب القبض
      const debitAccountCode = this.resolveDebitAccountCode(dto.paymentMethod);
      const accDebit = await tx.account.findUnique({ where: { farmId_code: { farmId, code: debitAccountCode } } });
      const accRevenue = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '4101' } } }); // إيرادات مبيعات الحليب الخام

      if (!accDebit || !accRevenue) {
        throw new BadRequestException('حسابات شجرة الحسابات المرتبطة بالمبيعات غير مكتملة في المزرعة');
      }

      // البحث عن مركز تكلفة الألبان إن وجد
      const costCenter = await tx.costCenter.findFirst({
        where: { farmId, type: 'DAIRY_PRODUCTION' },
        select: { id: true },
      });

      // إنشاء رقم الفاتورة ورقم القيد
      const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();
      const invoiceNumber = await this.nextInvoiceNumber(tx, farmId, 'MILK');
      const entryNumber = await this.nextJournalNumber(tx, farmId, fiscalYear.id, fiscalYear.yearName, 'SLM');

      // إنشاء قيد اليومية المزدوج
      const journalEntry = await tx.journalEntry.create({
        data: {
          farmId,
          fiscalYearId: fiscalYear.id,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber,
          entryDate: saleDate,
          type: JournalEntryType.MILK_SALE,
          status: JournalEntryStatus.POSTED,
          description: `فاتورة بيع حليب خام رقم (${invoiceNumber}) - العميل: ${dto.buyerName} (${dto.liters} لتر بسعر ${dto.pricePerLiter} د.ل)`,
          referenceId: `MILK_SALE:${invoiceNumber}`,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          postedAt: new Date(),
          postedBy: actor?.id ?? 'system',
          lines: {
            create: [
              {
                accountId: accDebit.id,
                costCenterId: costCenter?.id,
                debit: totalAmount,
                credit: 0,
                memo: `تحصيل مبيعات حليب (${this.paymentMethodName(dto.paymentMethod)}) - ${dto.buyerName}`,
              },
              {
                accountId: accRevenue.id,
                costCenterId: costCenter?.id,
                debit: 0,
                credit: totalAmount,
                memo: `إيراد بيع ${dto.liters} لتر حليب خام`,
              },
            ],
          },
        },
      });

      // تحديث أرصدة الحسابات
      await tx.account.update({
        where: { id: accDebit.id },
        data: { currentBalance: { increment: totalAmount } },
      });
      await tx.account.update({
        where: { id: accRevenue.id },
        data: { currentBalance: { increment: -totalAmount } },
      });

      // إنشاء سجل البيع التجاري
      const sale = await tx.commercialSale.create({
        data: {
          farmId,
          invoiceNumber,
          saleDate,
          saleType: SaleType.MILK,
          paymentMethod: dto.paymentMethod,
          buyerName: dto.buyerName,
          buyerPhone: dto.buyerPhone,
          notes: dto.notes,
          liters: dto.liters,
          pricePerLiter: dto.pricePerLiter,
          totalAmount,
          journalEntryId: journalEntry.id,
          createdById: actor?.id,
        },
      });

      if (actor) {
        await appendDomainAudit(tx, actor, {
          action: 'sales.milk.recorded',
          entityType: 'commercialSale',
          entityId: sale.id,
          farmId,
          metadata: { invoiceNumber, liters: dto.liters, pricePerLiter: dto.pricePerLiter, totalAmount, buyerName: dto.buyerName },
        });
      }

      return this.serializeCommercialSale(sale);
    }, this.serializableOptions());
  }

  /**
   * تسجيل عملية بيع حيوان حي أو ماشية تسمين مع تحديث حالته وقيده المحاسبي
   */
  async recordAnimalSale(
    dto: RecordAnimalSaleDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({
        where: { id: dto.animalId, farmId },
      });
      if (!animal) {
        throw new NotFoundException('لم يتم العثور على سجل الحيوان في مزرعة المستخدم');
      }
      if (animal.status === AnimalStatus.SOLD) {
        throw new BadRequestException(`الحيوان رقم (${animal.tagNumber}) مسجل كمباع مسبقاً`);
      }
      if (animal.status === AnimalStatus.DECEASED) {
        throw new BadRequestException(`لا يمكن بيع الحيوان رقم (${animal.tagNumber}) لأنه مسجل كنافق`);
      }

      // احتساب القيمة الإجمالية للبيع
      let totalAmount = 0;
      if (dto.pricingMethod === AnimalPricingMethod.BY_WEIGHT) {
        if (!dto.weightKg || dto.weightKg <= 0 || !dto.pricePerKg || dto.pricePerKg <= 0) {
          throw new BadRequestException('يجب إدخال الوزن القائم بالكيلوجرام وسعر الكيلو عند التسعير بالوزن');
        }
        totalAmount = Money.round(new Decimal(dto.weightKg).times(dto.pricePerKg).toNumber());
      } else {
        if (!dto.pricePerHead || dto.pricePerHead <= 0) {
          throw new BadRequestException('يجب إدخال سعر الرأس عند التسعير المقطوع');
        }
        totalAmount = Money.round(new Decimal(dto.pricePerHead).toNumber());
      }

      const { fiscalYear, fiscalPeriod } = await this.resolveOpenFiscalPeriod(tx, farmId);

      const debitAccountCode = this.resolveDebitAccountCode(dto.paymentMethod);
      const accDebit = await tx.account.findUnique({ where: { farmId_code: { farmId, code: debitAccountCode } } });
      const accRevenue = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '4102' } } }); // إيرادات مبيعات ماشية التسمين واللحوم

      if (!accDebit || !accRevenue) {
        throw new BadRequestException('حسابات شجرة الحسابات المرتبطة بمبيعات الماشية غير متوفرة');
      }

      const costCenter = await tx.costCenter.findFirst({
        where: { farmId, type: 'FATTENING_PRODUCTION' },
        select: { id: true },
      });

      const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();
      const invoiceNumber = await this.nextInvoiceNumber(tx, farmId, 'ANIMAL');
      const entryNumber = await this.nextJournalNumber(tx, farmId, fiscalYear.id, fiscalYear.yearName, 'SLA');

      // إنشاء قيد اليومية المزدوج
      const journalEntry = await tx.journalEntry.create({
        data: {
          farmId,
          fiscalYearId: fiscalYear.id,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber,
          entryDate: saleDate,
          type: JournalEntryType.CATTLE_SALE,
          status: JournalEntryStatus.POSTED,
          description: `فاتورة بيع ماشية حية رقم (${invoiceNumber}) - رقم القرط: ${animal.tagNumber} - العميل: ${dto.buyerName} بمبلغ ${totalAmount} د.ل`,
          referenceId: `ANIMAL_SALE:${animal.id}`,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          postedAt: new Date(),
          postedBy: actor?.id ?? 'system',
          lines: {
            create: [
              {
                accountId: accDebit.id,
                costCenterId: costCenter?.id,
                debit: totalAmount,
                credit: 0,
                memo: `قبض ثمن بيع الحيوان (${animal.tagNumber}) - ${dto.buyerName}`,
              },
              {
                accountId: accRevenue.id,
                costCenterId: costCenter?.id,
                debit: 0,
                credit: totalAmount,
                memo: `إيراد بيع ماشية حية (${animal.breed || animal.species}) - قرط ${animal.tagNumber}`,
              },
            ],
          },
        },
      });

      // تحديث أرصدة الحسابات
      await tx.account.update({
        where: { id: accDebit.id },
        data: { currentBalance: { increment: totalAmount } },
      });
      await tx.account.update({
        where: { id: accRevenue.id },
        data: { currentBalance: { increment: -totalAmount } },
      });

      // تحديث حالة الحيوان إلى مباع
      await tx.animal.update({
        where: { id: animal.id },
        data: { status: AnimalStatus.SOLD },
      });

      // إنشاء سجل البيع التجاري
      const sale = await tx.commercialSale.create({
        data: {
          farmId,
          invoiceNumber,
          saleDate,
          saleType: SaleType.LIVE_ANIMAL,
          paymentMethod: dto.paymentMethod,
          buyerName: dto.buyerName,
          buyerPhone: dto.buyerPhone,
          notes: dto.notes,
          animalId: animal.id,
          pricingMethod: dto.pricingMethod,
          weightKg: dto.weightKg,
          pricePerKg: dto.pricePerKg,
          pricePerHead: dto.pricePerHead,
          totalAmount,
          journalEntryId: journalEntry.id,
          createdById: actor?.id,
        },
      });

      if (actor) {
        await appendDomainAudit(tx, actor, {
          action: 'sales.animal.recorded',
          entityType: 'commercialSale',
          entityId: sale.id,
          farmId,
          metadata: { invoiceNumber, animalId: animal.id, tagNumber: animal.tagNumber, totalAmount, buyerName: dto.buyerName },
        });
      }

      return this.serializeCommercialSale(sale);
    }, this.serializableOptions());
  }

  /**
   * تسجيل نفوق حيوان واحتساب الخسارة البيولوجية والقيد المالي المزدوج (IAS 41)
   */
  async recordAnimalMortality(
    dto: RecordMortalityDto,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const animal = await tx.animal.findFirst({
        where: { id: dto.animalId, farmId },
      });
      if (!animal) {
        throw new NotFoundException('لم يتم العثور على سجل الحيوان في مزرعة المستخدم');
      }
      if (animal.status === AnimalStatus.DECEASED) {
        throw new BadRequestException(`الحيوان رقم (${animal.tagNumber}) مسجل كنافق مسبقاً`);
      }
      if (animal.status === AnimalStatus.SOLD) {
        throw new BadRequestException(`لا يمكن تسجيل نفوق لحيوان تم بيعه بالفعل`);
      }

      // تحديد القيمة الدفترية للأصل البيولوجي (IAS 41 Book Value)
      let bookValue = 0;
      if (animal.purchasePrice && Number(animal.purchasePrice) > 0) {
        bookValue = Number(animal.purchasePrice);
      } else if (dto.estimatedBookValue && dto.estimatedBookValue > 0) {
        bookValue = dto.estimatedBookValue;
      } else {
        // قيمة افتراضية تقديرية للأصل البيولوجي حسب نوع الماشية بالدينار الليبي
        switch (animal.species) {
          case Species.CATTLE:
            bookValue = 1500;
            break;
          case Species.SHEEP:
            bookValue = 400;
            break;
          case Species.GOAT:
            bookValue = 300;
            break;
          default:
            bookValue = 500;
        }
      }

      const salvageValue = dto.salvageValue && dto.salvageValue > 0 ? dto.salvageValue : 0;
      if (salvageValue > bookValue) {
        throw new BadRequestException(`قيمة الاسترداد (${salvageValue} د.ل) لا يمكن أن تتجاوز القيمة الدفترية للحيوان (${bookValue} د.ل)`);
      }

      const netLoss = Money.round(new Decimal(bookValue).minus(salvageValue).toNumber());

      const { fiscalYear, fiscalPeriod } = await this.resolveOpenFiscalPeriod(tx, farmId);

      // تحديد حساب الأصل البيولوجي الدائن
      let assetAccountCode = '1202'; // قطيع التسمين واللحم
      if (animal.species === Species.CATTLE && animal.purpose === Purpose.DAIRY) {
        assetAccountCode = '1201'; // قطيع الألبان الحلاب
      }
      if (animal.currentLifeStage === 'CALF') {
        assetAccountCode = '1203'; // العجول والمواليد الرضيعة
      }

      const accMortalityLoss = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '5105' } } }); // خسائر نفوق واستبعاد الماشية
      const accBioAsset = await tx.account.findUnique({ where: { farmId_code: { farmId, code: assetAccountCode } } });
      const accCash = salvageValue > 0 ? await tx.account.findUnique({ where: { farmId_code: { farmId, code: '1101' } } }) : null;

      if (!accMortalityLoss || !accBioAsset || (salvageValue > 0 && !accCash)) {
        throw new BadRequestException('حسابات شجرة الحسابات المرتبطة بالأصول البيولوجية وخسائر النفوق غير متوفرة');
      }

      const deathDate = new Date(dto.deathDate);
      const entryNumber = await this.nextJournalNumber(tx, farmId, fiscalYear.id, fiscalYear.yearName, 'MORT');

      // تجهيز أسطر القيد المحاسبي المزدوج
      const journalLines: Prisma.JournalEntryLineUncheckedCreateWithoutJournalEntryInput[] = [];

      // سطر مدين: مصروف خسائر النفوق بالصافي
      if (netLoss > 0) {
        journalLines.push({
          accountId: accMortalityLoss.id,
          debit: netLoss,
          credit: 0,
          memo: `خسائر نفوق ماشية - قرط ${animal.tagNumber} (${dto.causeOfDeath})`,
        });
      }

      // سطر مدين: تحصيل نقدية التخريد إن وجدت
      if (salvageValue > 0 && accCash) {
        journalLines.push({
          accountId: accCash.id,
          debit: salvageValue,
          credit: 0,
          memo: `قيمة استردادية / تخريد للحيوان النافق ${animal.tagNumber}`,
        });
      }

      // سطر دائن: استبعاد الأصل البيولوجي بالقيمة الدفترية الكاملة
      journalLines.push({
        accountId: accBioAsset.id,
        debit: 0,
        credit: bookValue,
        memo: `استبعاد الأصل البيولوجي بسبب النفوق - ${animal.tagNumber}`,
      });

      // إنشاء القيد المحاسبي المتوازن تماماً
      const journalEntry = await tx.journalEntry.create({
        data: {
          farmId,
          fiscalYearId: fiscalYear.id,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber,
          entryDate: deathDate,
          type: JournalEntryType.MORTALITY_LOSS,
          status: JournalEntryStatus.POSTED,
          description: `إثبات خسارة نفوق الحيوان (${animal.tagNumber}) - السبب: ${dto.causeOfDeath} - صافي الخسارة: ${netLoss} د.ل`,
          referenceId: `MORTALITY:${animal.id}`,
          totalDebit: bookValue,
          totalCredit: bookValue,
          postedAt: new Date(),
          postedBy: actor?.id ?? 'system',
          lines: {
            create: journalLines,
          },
        },
      });

      // تحديث أرصدة الحسابات
      if (netLoss > 0) {
        await tx.account.update({
          where: { id: accMortalityLoss.id },
          data: { currentBalance: { increment: netLoss } },
        });
      }
      if (salvageValue > 0 && accCash) {
        await tx.account.update({
          where: { id: accCash.id },
          data: { currentBalance: { increment: salvageValue } },
        });
      }
      await tx.account.update({
        where: { id: accBioAsset.id },
        data: { currentBalance: { increment: -bookValue } },
      });

      // تحديث حالة الحيوان إلى نافق
      await tx.animal.update({
        where: { id: animal.id },
        data: { status: AnimalStatus.DECEASED },
      });

      // تسجيل واقعة النفوق
      const mortality = await tx.animalMortality.create({
        data: {
          farmId,
          animalId: animal.id,
          deathDate,
          causeOfDeath: dto.causeOfDeath,
          salvageValue,
          bookValue,
          netLoss,
          notes: dto.notes,
          journalEntryId: journalEntry.id,
          recordedById: actor?.id,
        },
      });

      if (actor) {
        await appendDomainAudit(tx, actor, {
          action: 'herd.animal.mortality',
          entityType: 'animalMortality',
          entityId: mortality.id,
          farmId,
          metadata: { animalId: animal.id, tagNumber: animal.tagNumber, causeOfDeath: dto.causeOfDeath, bookValue, netLoss },
        });
      }

      return this.serializeAnimalMortality(mortality);
    }, this.serializableOptions());
  }

  /**
   * جلب سجل المبيعات التجارية
   */
  async getSales(farmId: string, limit = 100) {
    const sales = await this.prisma.commercialSale.findMany({
      where: { farmId },
      orderBy: { saleDate: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        animal: {
          select: {
            id: true,
            tagNumber: true,
            species: true,
            breed: true,
            gender: true,
          },
        },
      },
    });

    return sales.map(s => this.serializeCommercialSale(s));
  }

  /**
   * جلب سجل حالات النفوق والخسائر
   */
  async getMortalities(farmId: string, limit = 100) {
    const mortalities = await this.prisma.animalMortality.findMany({
      where: { farmId },
      orderBy: { deathDate: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        animal: {
          select: {
            id: true,
            tagNumber: true,
            species: true,
            breed: true,
            gender: true,
          },
        },
      },
    });

    return mortalities.map(m => this.serializeAnimalMortality(m));
  }

  /**
   * تفاصيل عملية بيع محددة
   */
  async getSaleById(id: string, farmId: string) {
    const sale = await this.prisma.commercialSale.findFirst({
      where: { id, farmId },
      include: {
        animal: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('لم يتم العثور على فاتورة البيع');
    return this.serializeCommercialSale(sale);
  }

  /**
   * ملخص مؤشرات المبيعات والنفوق التراكمية
   */
  async getSalesSummary(farmId: string) {
    const [sales, mortalities] = await Promise.all([
      this.prisma.commercialSale.findMany({ where: { farmId } }),
      this.prisma.animalMortality.findMany({ where: { farmId } }),
    ]);

    let totalSalesLyd = new Decimal(0);
    let milkSalesLyd = new Decimal(0);
    let animalSalesLyd = new Decimal(0);
    let totalMilkLiters = new Decimal(0);
    let totalAnimalsSold = 0;

    for (const sale of sales) {
      const amount = new Decimal(sale.totalAmount.toString());
      totalSalesLyd = totalSalesLyd.plus(amount);
      if (sale.saleType === SaleType.MILK) {
        milkSalesLyd = milkSalesLyd.plus(amount);
        if (sale.liters) totalMilkLiters = totalMilkLiters.plus(new Decimal(sale.liters.toString()));
      } else if (sale.saleType === SaleType.LIVE_ANIMAL) {
        animalSalesLyd = animalSalesLyd.plus(amount);
        totalAnimalsSold += 1;
      }
    }

    let totalMortalityLossLyd = new Decimal(0);
    for (const mort of mortalities) {
      totalMortalityLossLyd = totalMortalityLossLyd.plus(new Decimal(mort.netLoss.toString()));
    }

    return {
      totalSalesLyd: totalSalesLyd.toFixed(3),
      milkSalesLyd: milkSalesLyd.toFixed(3),
      animalSalesLyd: animalSalesLyd.toFixed(3),
      totalMilkLiters: totalMilkLiters.toFixed(3),
      totalAnimalsSold,
      totalMortalityLossLyd: totalMortalityLossLyd.toFixed(3),
      totalDeceasedAnimals: mortalities.length,
    };
  }

  // --- دوال مساعدة داخلية ---

  private resolveDebitAccountCode(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CASH:
        return '1101'; // الصندوق والخزينة الرئيسية
      case PaymentMethod.BANK:
        return '1102'; // الحسابات البنكية للمزرعة
      case PaymentMethod.ON_ACCOUNT:
        return '1103'; // العملاء والمدينون
      default:
        return '1101';
    }
  }

  private paymentMethodName(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CASH: return 'نقداً';
      case PaymentMethod.BANK: return 'تحويل بنكي';
      case PaymentMethod.ON_ACCOUNT: return 'آجل / ذمم مدينة';
      default: return 'نقداً';
    }
  }

  private async resolveOpenFiscalPeriod(tx: Prisma.TransactionClient, farmId: string) {
    const fiscalYear = await tx.fiscalYear.findFirst({
      where: { farmId, status: FiscalStatus.OPEN, isCurrent: true },
      include: {
        periods: { where: { status: FiscalStatus.OPEN }, orderBy: { periodNumber: 'asc' }, take: 1 },
      },
    });

    if (!fiscalYear || fiscalYear.periods.length === 0) {
      throw new BadRequestException('لا توجد سنة أو فترة مالية مفتوحة لتسجيل القيود المحاسبية');
    }

    return { fiscalYear, fiscalPeriod: fiscalYear.periods[0] };
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient, farmId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.commercialSale.count({ where: { farmId } });
    return `INV-${year}-${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextJournalNumber(
    tx: Prisma.TransactionClient,
    farmId: string,
    fiscalYearId: string,
    yearName: string,
    prefix = 'JV',
  ): Promise<string> {
    const seq = await tx.journalSequence.upsert({
      where: { farmId_fiscalYearId: { farmId, fiscalYearId } },
      update: { nextNumber: { increment: 1 } },
      create: { farmId, fiscalYearId, nextNumber: 2 },
    });
    const num = seq.nextNumber - 1;
    return `${prefix}-${yearName}-${String(num).padStart(4, '0')}`;
  }

  private serializeCommercialSale(sale: any) {
    return {
      id: sale.id,
      farmId: sale.farmId,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate instanceof Date ? sale.saleDate.toISOString() : String(sale.saleDate),
      saleType: sale.saleType,
      paymentMethod: sale.paymentMethod,
      buyerName: sale.buyerName,
      buyerPhone: sale.buyerPhone ?? null,
      notes: sale.notes ?? null,
      liters: sale.liters != null ? new Decimal(sale.liters.toString()).toFixed(3) : null,
      pricePerLiter: sale.pricePerLiter != null ? new Decimal(sale.pricePerLiter.toString()).toFixed(3) : null,
      animalId: sale.animalId ?? null,
      pricingMethod: sale.pricingMethod ?? null,
      weightKg: sale.weightKg != null ? new Decimal(sale.weightKg.toString()).toFixed(3) : null,
      pricePerKg: sale.pricePerKg != null ? new Decimal(sale.pricePerKg.toString()).toFixed(3) : null,
      pricePerHead: sale.pricePerHead != null ? new Decimal(sale.pricePerHead.toString()).toFixed(3) : null,
      totalAmount: new Decimal(sale.totalAmount.toString()).toFixed(3),
      journalEntryId: sale.journalEntryId ?? null,
      createdById: sale.createdById ?? null,
      createdAt: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : String(sale.createdAt),
      updatedAt: sale.updatedAt instanceof Date ? sale.updatedAt.toISOString() : String(sale.updatedAt),
      animal: sale.animal ?? undefined,
      journalEntry: sale.journalEntry ?? undefined,
    };
  }

  private serializeAnimalMortality(mort: any) {
    return {
      id: mort.id,
      farmId: mort.farmId,
      animalId: mort.animalId,
      deathDate: mort.deathDate instanceof Date ? mort.deathDate.toISOString().split('T')[0] : String(mort.deathDate),
      causeOfDeath: mort.causeOfDeath,
      salvageValue: new Decimal(mort.salvageValue.toString()).toFixed(3),
      bookValue: new Decimal(mort.bookValue.toString()).toFixed(3),
      netLoss: new Decimal(mort.netLoss.toString()).toFixed(3),
      notes: mort.notes ?? null,
      journalEntryId: mort.journalEntryId ?? null,
      recordedById: mort.recordedById ?? null,
      createdAt: mort.createdAt instanceof Date ? mort.createdAt.toISOString() : String(mort.createdAt),
      animal: mort.animal ?? undefined,
      journalEntry: mort.journalEntry ?? undefined,
    };
  }

  private serializableOptions(): { isolationLevel: Prisma.TransactionIsolationLevel; maxWait: number; timeout: number } {
    return {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    };
  }
}
