import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { optimizeStoredRation } from './round-ration';
import { resolveOpenFiscalPeriod } from '../../common/accounting/fiscal-period';
import { calendarDate } from '../../common/utils/calendar-date';
import { PrismaService } from '../../database/prisma.service';
import { Money } from '../../common/utils/money.util';
import { CostCenterType, FiscalStatus, JournalEntryStatus, JournalEntryType, Prisma, SectorType, TransactionType } from '@prisma/client';
import { appendDomainAudit, AuditActor } from '../../common/audit/domain-audit';
import { IdempotencyContext } from '../../common/idempotency/idempotency-context';
import { runIdempotentTransaction } from '../../common/idempotency/idempotency-transaction';

export interface RationIngredientInput {
  id: string;
  name: string;
  costPerKg: number;
  proteinPct: number; // نسبة البروتين الخام %
  energyMcal: number; // الطاقة Mcal/kg
  minInclusionPct?: number; // الحد الأدنى للنسبة %
  maxInclusionPct?: number; // الحد الأقصى للنسبة %
}

export interface FormulationTarget {
  targetProteinPct: number; // مثلاً 18% للأبقار الحلابة أو 14% للتسمين
  batchTotalKg: number;    // حجم الخلطة المطلوب بالكيلوجرام (مثلاً 1000 كجم = 1 طن)
}

@Injectable()
export class RationService {
  constructor(private prisma: PrismaService) {}

  /**
   * خوارزمية تركيب العليقة بأقل تكلفة (Least-Cost Ration Optimization)
   * تستخدم البرمجة الخطية المقيدة (Bounded Linear Optimization) لتحقيق الاحتياج الغذائي بأقل سعر
   * مع الالتزام التام بالحدود الدنيا والقصوى لكل مادة علفية
   */
  calculateLeastCostRation(ingredients: RationIngredientInput[], target: FormulationTarget) {
    if (!ingredients || ingredients.length < 2) {
      throw new BadRequestException('يجب توفير مادتين علفيتين على الأقل للخلط (مصدر بروتين + مصدر طاقة)');
    }
    if (!Number.isFinite(target.batchTotalKg) || target.batchTotalKg <= 0) {
      throw new BadRequestException('حجم الخلطة المطلوب يجب أن يكون رقماً موجباً');
    }
    if (!target.targetProteinPct || target.targetProteinPct <= 0) {
      throw new BadRequestException('نسبة البروتين المستهدفة يجب أن تكون رقماً موجباً');
    }

    const bestRatios = optimizeStoredRation(ingredients, target.targetProteinPct);
    const bestAchievedProtein = bestRatios.reduce((sum, ratio, i) => sum + ratio * ingredients[i].proteinPct, 0);

    const items = ingredients
      .map((ing, idx) => {
        const ratio = bestRatios![idx];
        const percentage = Money.roundDecimal(ratio * 100, 2).toNumber();
        const weightKg = Money.roundDecimal(target.batchTotalKg * ratio, 6).toNumber();
        const cost = Money.roundDecimal(Money.multiply(weightKg, ing.costPerKg), 2).toNumber();
        return {
          ingredientId: ing.id,
          name: ing.name,
          percentage,
          weightKg,
          cost,
        };
      })
      .filter(item => item.weightKg > 0);

    const totalCost = Money.roundDecimal(items.reduce((sum, it) => sum + it.cost, 0), 2).toNumber();
    const costPerKg = Money.roundDecimal(Money.divide(totalCost, target.batchTotalKg), 3).toNumber();
    const actualProteinPct = Money.roundDecimal(bestAchievedProtein, 2).toNumber();

    return {
      targetProteinPct: target.targetProteinPct,
      actualProteinPct,
      batchTotalKg: target.batchTotalKg,
      totalCost,
      costPerKg,
      costPerTon: Money.roundDecimal(Money.multiply(costPerKg, 1000), 2).toNumber(),
      items,
    };
  }

  /**
   * صرف العليقة للحظيرة وخصم المخزون والترحيل المالي لمراكز التكلفة آلياً
   */
  async dispenseFeedToBarn(
    barnId: string,
    formulaId: string,
    quantityKg: number,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
      throw new BadRequestException('كمية الصرف يجب أن تكون رقماً موجباً');
    }

    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const barn = await tx.barn.findFirst({
        where: { id: barnId, farmId },
        include: { farm: true },
      });
      if (!barn) throw new NotFoundException('الحظيرة غير موجودة');

      const formula = await tx.feedFormula.findFirst({
        where: { id: formulaId, farmId },
        include: { items: { include: { ingredient: true } } },
      });
      if (!formula) throw new NotFoundException('الخلطة العلفية غير موجودة');

      let totalFormulaCost = 0;
      for (const item of formula.items) {
        const requiredKg = (quantityKg * Number(item.percentage)) / 100;
        if (Number(item.ingredient.currentStock) < requiredKg) {
          throw new BadRequestException(
            `رصيد المادة (${item.ingredient.name}) غير كافٍ. المطلوب: ${requiredKg.toFixed(1)} كجم، المتاح: ${Number(item.ingredient.currentStock).toFixed(1)} كجم`,
          );
        }
        totalFormulaCost += requiredKg * Number(item.ingredient.costPerUnit);
      }

      for (const item of formula.items) {
        const requiredKg = (quantityKg * Number(item.percentage)) / 100;
        const stockUpdate = await tx.feedIngredient.updateMany({
          where: {
            id: item.ingredient.id,
            farmId,
            currentStock: { gte: requiredKg },
          },
          data: { currentStock: { decrement: requiredKg } },
        });
        if (stockUpdate.count !== 1) {
          throw new BadRequestException(`تغير رصيد المادة (${item.ingredient.name}) ولم يعد كافياً لإتمام الصرف`);
        }
      }

      const dispenseDate = calendarDate(new Date());

      const createdDistribution = await tx.feedDistribution.create({
        data: {
          barnId,
          formulaId,
          dispenseDate,
          quantityKg,
          totalCost: totalFormulaCost,
        },
      });

      const costCenter = await tx.costCenter.findFirst({
        where: {
          farmId,
          type: barn.sectorType === 'DAIRY' ? CostCenterType.DAIRY_PRODUCTION : CostCenterType.FATTENING_PRODUCTION,
        },
      });

      if (costCenter) {
        await tx.financialTransaction.create({
          data: {
            costCenterId: costCenter.id,
            transDate: dispenseDate,
            type: TransactionType.EXPENSE,
            category: 'تكلفة أعلاف الحظائر (TMR)',
            amount: totalFormulaCost,
            description: `صرف ${quantityKg} كجم من خلطة (${formula.name}) للحظيرة (${barn.name})`,
            referenceId: createdDistribution.id,
          },
        });
      }

      // إنشاء قيد اليومية المزدوج آلياً في الدفتر العام (General Ledger)
      if (totalFormulaCost > 0) {
        const accFeedExp = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '5101' } } });
        const accFeedStock = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '1104' } } });

        if (!accFeedExp || !accFeedStock) {
          throw new BadRequestException('حسابات مصروف الأعلاف (5101) أو مخزون الأعلاف (1104) غير معرفة في شجرة الحسابات');
        }

        const { fiscalYear, fiscalPeriod } = await resolveOpenFiscalPeriod(tx, farmId, dispenseDate);
        const entryNumber = `JV-${fiscalYear.yearName}-F${Date.now().toString().slice(-6)}`;

        await tx.journalEntry.create({
          data: {
            farmId,
            fiscalYearId: fiscalYear.id,
            fiscalPeriodId: fiscalPeriod.id,
            entryNumber,
            entryDate: dispenseDate,
            type: JournalEntryType.FEED_DISPENSE,
            status: JournalEntryStatus.POSTED,
            description: `صرف ${quantityKg} كجم من خلطة (${formula.name}) للحظيرة (${barn.name})`,
            referenceId: `FEED_DISPENSE:${createdDistribution.id}`,
            totalDebit: totalFormulaCost,
            totalCredit: totalFormulaCost,
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: accFeedExp.id, debit: totalFormulaCost, credit: 0, memo: `مصروف أعلاف - ${barn.name}` },
                { accountId: accFeedStock.id, debit: 0, credit: totalFormulaCost, memo: `صرف من مخزون الأعلاف (${formula.name})` },
              ],
            },
          },
        });

        // تحديث أرصدة الحسابات بالدفتر العام
        await tx.account.update({
          where: { id: accFeedExp.id },
          data: { currentBalance: { increment: totalFormulaCost } },
        });
        await tx.account.update({
          where: { id: accFeedStock.id },
          data: { currentBalance: { decrement: totalFormulaCost } },
        });
      }

      if (actor) await appendDomainAudit(tx, actor, {
        action: 'nutrition.feed.dispensed',
        entityType: 'feedDistribution',
        entityId: createdDistribution.id,
        farmId,
        metadata: { barnId, formulaId, quantityKg, totalCost: totalFormulaCost },
      });

      return {
        message: 'تم صرف العلف بنجاح وتحديث أرصدة المخازن والقيود المالية',
        distribution: createdDistribution,
        totalCost: totalFormulaCost,
        costPerKg: (totalFormulaCost / quantityKg).toFixed(3),
      };
    });
  }

  async getFeedStock(farmId: string) {
    return this.prisma.feedIngredient.findMany({
      where: { farmId },
      orderBy: { currentStock: 'asc' },
    });
  }

  async createIngredient(data: {
    name: string;
    unit?: string;
    currentStock: number;
    minStockAlert?: number;
    costPerUnit: number;
    dryMatterPct?: number;
    proteinPct?: number;
    energyMcal?: number;
  }, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const ingredient = await tx.feedIngredient.create({
        data: {
          farmId,
          name: data.name,
          unit: data.unit ?? 'KG',
          currentStock: data.currentStock,
          minStockAlert: data.minStockAlert ?? 0,
          costPerUnit: data.costPerUnit,
          dryMatterPct: data.dryMatterPct,
          proteinPct: data.proteinPct,
          energyMcal: data.energyMcal,
        },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'nutrition.ingredient.created',
        entityType: 'feedIngredient',
        entityId: ingredient.id,
        farmId,
        metadata: { unit: ingredient.unit },
      });
      return ingredient;
    });
  }

  async updateIngredientStock(
    id: string,
    addedKg: number,
    costPerUnit: number | undefined,
    farmId: string,
    actor?: AuditActor,
    idempotency?: IdempotencyContext,
  ) {
    if (!Number.isFinite(addedKg) || addedKg <= 0) {
      throw new BadRequestException('الكمية المضافة يجب أن تكون رقماً موجباً');
    }
    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const ingredient = await tx.feedIngredient.findFirst({ where: { id, farmId } });
      if (!ingredient) throw new NotFoundException('المادة العلفية غير موجودة');

      const currentStockNum = Number(ingredient.currentStock || 0);
      const currentCostNum = Number(ingredient.costPerUnit || 0);
      let effectiveCostPerUnit = currentCostNum;

      if (costPerUnit !== undefined && Number.isFinite(costPerUnit) && costPerUnit >= 0) {
        if (currentStockNum <= 0) {
          effectiveCostPerUnit = costPerUnit;
        } else {
          const currentTotalVal = currentStockNum * currentCostNum;
          const incomingTotalVal = addedKg * costPerUnit;
          const totalNewStock = currentStockNum + addedKg;
          effectiveCostPerUnit = totalNewStock > 0 ? (currentTotalVal + incomingTotalVal) / totalNewStock : costPerUnit;
        }
      }

      const updateData: Prisma.FeedIngredientUpdateInput = {
        currentStock: { increment: addedKg },
        costPerUnit: Money.roundDecimal(effectiveCostPerUnit, 3).toNumber(),
      };
      const updated = await tx.feedIngredient.update({ where: { id }, data: updateData });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'nutrition.stock.received',
        entityType: 'feedIngredient',
        entityId: id,
        farmId,
        metadata: { addedKg, costChanged: costPerUnit !== undefined },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getFormulas(farmId: string) {
    return this.prisma.feedFormula.findMany({
      where: { farmId },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFormula(data: {
    name: string;
    targetSector?: SectorType;
    description?: string;
    items: { ingredientId: string; percentage: number }[];
  }, farmId: string, actor?: AuditActor, idempotency?: IdempotencyContext) {
    if (!data.items?.length) throw new BadRequestException('يجب إضافة مكون واحد على الأقل للخلطة');
    const ingredientIds = [...new Set(data.items.map(item => item.ingredientId))];
    if (ingredientIds.length !== data.items.length) throw new BadRequestException('لا يجوز تكرار مادة في الخلطة');
    const totalPercentage = data.items.reduce((sum, item) => Money.add(sum, item.percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.001) {
      throw new BadRequestException('يجب أن يكون مجموع نسب مكونات الخلطة 100%');
    }

    return runIdempotentTransaction(this.prisma, actor, idempotency, async tx => {
      const ownedIngredients = await tx.feedIngredient.count({
        where: { id: { in: ingredientIds }, farmId },
      });
      if (ownedIngredients !== ingredientIds.length) {
        throw new NotFoundException('تحتوي الخلطة على مادة علفية غير موجودة في مزرعة المستخدم');
      }

      const formula = await tx.feedFormula.create({
        data: {
          farmId,
          name: data.name,
          targetSector: data.targetSector || 'DAIRY',
          description: data.description,
          items: {
            create: data.items.map(item => ({
              ingredientId: item.ingredientId,
              percentage: item.percentage,
            })),
          },
        },
        include: {
          items: {
            include: { ingredient: true },
          },
        },
      });
      if (actor) await appendDomainAudit(tx, actor, {
        action: 'nutrition.formula.created',
        entityType: 'feedFormula',
        entityId: formula.id,
        farmId,
        metadata: { ingredientCount: data.items.length, targetSector: formula.targetSector },
      });
      return formula;
    });
  }

  async getDistributions(farmId: string) {
    return this.prisma.feedDistribution.findMany({
      where: { barn: { farmId } },
      include: {
        barn: true,
        formula: true,
      },
      orderBy: { dispenseDate: 'desc' },
      take: 50,
    });
  }
}
