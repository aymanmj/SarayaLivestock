import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    if (!target.batchTotalKg || target.batchTotalKg <= 0) {
      throw new BadRequestException('حجم الخلطة المطلوب يجب أن يكون رقماً موجباً');
    }
    if (!target.targetProteinPct || target.targetProteinPct <= 0) {
      throw new BadRequestException('نسبة البروتين المستهدفة يجب أن تكون رقماً موجباً');
    }

    const P = target.targetProteinPct;
    const n = ingredients.length;

    // تجهيز الحدود الدنيا والقصوى لكل مادة كنسبة عشرية [0, 1]
    const bounds = ingredients.map(ing => {
      const minRatio = Math.max(0, (ing.minInclusionPct || 0) / 100);
      const maxRatio = Math.min(1, Math.max(minRatio, (ing.maxInclusionPct !== undefined ? ing.maxInclusionPct : 100) / 100));
      return { min: minRatio, max: maxRatio };
    });

    const sumMin = bounds.reduce((acc, b) => acc + b.min, 0);
    const sumMax = bounds.reduce((acc, b) => acc + b.max, 0);

    if (sumMin > 1.0001) {
      throw new BadRequestException(`مجموع الحدود الدنيا للمكونات (${(sumMin * 100).toFixed(1)}%) يتجاوز 100%`);
    }
    if (sumMax < 0.9999) {
      throw new BadRequestException(`مجموع الحدود القصوى للمكونات (${(sumMax * 100).toFixed(1)}%) أقل من 100%`);
    }

    // البحث عن التوليفة المثلى (الأقل تكلفة التي تغطي البروتين المطلوب ضمن الحدود)
    let bestRatios: number[] | null = null;
    let bestCost = Infinity;
    let bestAchievedProtein = -1;

    // فحص كل الأزواج الممكنة (i, j) لتكون المتغيرات الحرة (Basic Variables)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const fixedRatios = new Array(n).fill(0);
        let fixedSum = 0;
        let fixedProtein = 0;

        for (let k = 0; k < n; k++) {
          if (k !== i && k !== j) {
            fixedRatios[k] = bounds[k].min;
            fixedSum += fixedRatios[k];
            fixedProtein += fixedRatios[k] * ingredients[k].proteinPct;
          }
        }

        const remSum = 1.0 - fixedSum;
        const remProtein = P - fixedProtein;

        const p_i = ingredients[i].proteinPct;
        const p_j = ingredients[j].proteinPct;
        const denom = p_i - p_j;

        if (Math.abs(denom) > 1e-6) {
          const x_i = (remProtein - p_j * remSum) / denom;
          const x_j = remSum - x_i;

          if (
            x_i >= bounds[i].min - 1e-6 &&
            x_i <= bounds[i].max + 1e-6 &&
            x_j >= bounds[j].min - 1e-6 &&
            x_j <= bounds[j].max + 1e-6
          ) {
            const clamped_i = Math.max(bounds[i].min, Math.min(bounds[i].max, x_i));
            const clamped_j = Math.max(bounds[j].min, Math.min(bounds[j].max, x_j));
            const candidateRatios = [...fixedRatios];
            candidateRatios[i] = clamped_i;
            candidateRatios[j] = clamped_j;

            const cost = candidateRatios.reduce((sum, r, idx) => sum + r * ingredients[idx].costPerKg, 0);
            const achievedP = candidateRatios.reduce((sum, r, idx) => sum + r * ingredients[idx].proteinPct, 0);

            if (cost < bestCost) {
              bestCost = cost;
              bestRatios = candidateRatios;
              bestAchievedProtein = achievedP;
            }
          }
        }
      }
    }

    let warning: string | undefined;
    if (!bestRatios) {
      // إشباع المكونات بالحدود القصوى للبروتين الأعلى، وملء الباقي بأقل المكونات تكلفة مع الالتزام بالحدود
      const candidateRatios = bounds.map(b => b.min);
      let allocated = candidateRatios.reduce((sum, r) => sum + r, 0);

      const sortedIdx = ingredients
        .map((ing, idx) => ({ idx, protein: ing.proteinPct, cost: ing.costPerKg }))
        .sort((a, b) => (b.protein / (b.cost || 1)) - (a.protein / (a.cost || 1)));

      for (const item of sortedIdx) {
        const canAdd = Math.min(bounds[item.idx].max - candidateRatios[item.idx], 1.0 - allocated);
        if (canAdd > 0) {
          candidateRatios[item.idx] += canAdd;
          allocated += canAdd;
        }
        if (Math.abs(allocated - 1.0) < 1e-6) break;
      }

      bestRatios = candidateRatios;
      bestAchievedProtein = bestRatios.reduce((sum, r, idx) => sum + r * ingredients[idx].proteinPct, 0);
      bestCost = bestRatios.reduce((sum, r, idx) => sum + r * ingredients[idx].costPerKg, 0);
      warning = `تنبيه: تم الالتزام الصارم بحدود الإدراج القصوى؛ حققت الخلطة أعلى بروتين ممكن (${bestAchievedProtein.toFixed(1)}%) نظراً للقيود المفروضة.`;
    }

    const items = ingredients
      .map((ing, idx) => {
        const ratio = bestRatios![idx];
        const percentage = Money.roundDecimal(ratio * 100, 2).toNumber();
        const weightKg = Money.roundDecimal(target.batchTotalKg * ratio, 2).toNumber();
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
      ...(warning ? { warning } : {}),
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

      const createdDistribution = await tx.feedDistribution.create({
        data: {
          barnId,
          formulaId,
          dispenseDate: new Date(),
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
            transDate: new Date(),
            type: TransactionType.EXPENSE,
            category: 'تكلفة أعلاف الحظائر (TMR)',
            amount: totalFormulaCost,
            description: `صرف ${quantityKg} كجم من خلطة (${formula.name}) للحظيرة (${barn.name})`,
            referenceId: createdDistribution.id,
          },
        });
      }

      // إنشاء قيد اليومية المزدوج آلياً في الدفتر العام (General Ledger)
      if (totalFormulaCost > 0 && tx.journalEntry?.create) {
        const accFeedExp = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '5101' } } });
        const accFeedStock = await tx.account.findUnique({ where: { farmId_code: { farmId, code: '1104' } } });
        const currentYear = await tx.fiscalYear.findFirst({
          where: { farmId, isCurrent: true, status: FiscalStatus.OPEN },
          include: { periods: { where: { status: FiscalStatus.OPEN }, orderBy: { periodNumber: 'asc' }, take: 1 } },
        });

        if (accFeedExp && accFeedStock && currentYear && currentYear.periods.length > 0) {
          const fiscalPeriod = currentYear.periods[0];
          const entryDate = new Date();
          const entryNumber = `JV-${currentYear.yearName}-F${Date.now().toString().slice(-6)}`;
          await tx.journalEntry.create({
            data: {
              farmId,
              fiscalYearId: currentYear.id,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber,
              entryDate,
              type: JournalEntryType.FEED_DISPENSE,
              status: JournalEntryStatus.POSTED,
              description: `صرف ${quantityKg} كجم من خلطة (${formula.name}) للحظيرة (${barn.name})`,
              referenceId: `FEED_DISPENSE:${createdDistribution.id}`,
              totalDebit: totalFormulaCost,
              totalCredit: totalFormulaCost,
              postedAt: entryDate,
              lines: {
                create: [
                  { accountId: accFeedExp.id, debit: totalFormulaCost, credit: 0, memo: `مصروف أعلاف - ${barn.name}` },
                  { accountId: accFeedStock.id, debit: 0, credit: totalFormulaCost, memo: `صرف من مخزون الأعلاف (${formula.name})` },
                ],
              },
            },
          });
        }
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
    });
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
    const totalPercentage = data.items.reduce((sum, item) => Money.add(sum, item.percentage as any), 0);
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

