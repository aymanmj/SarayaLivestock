import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Money } from '../../common/utils/money.util';
import { CostCenterType, Prisma, SectorType, TransactionType } from '@prisma/client';
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
   * تبحث عن أفضل نسب خلط بين مصادر الطاقة والبروتين والمالئات لتحقيق الاحتياج الغذائي بأقل سعر
   */
  calculateLeastCostRation(ingredients: RationIngredientInput[], target: FormulationTarget) {
    if (!ingredients || ingredients.length < 2) {
      throw new BadRequestException('يجب توفير مادتين علفيتين على الأقل للخلط (مصدر بروتين + مصدر طاقة)');
    }

    // فرز المكونات إلى مصادر طاقة (بروتين أقل من الهدف) ومصادر بروتين (بروتين أعلى من الهدف)
    const highProtein = ingredients.filter(i => i.proteinPct >= target.targetProteinPct);
    const lowProtein = ingredients.filter(i => i.proteinPct < target.targetProteinPct);

    if (highProtein.length === 0 || lowProtein.length === 0) {
      throw new BadRequestException('يجب توفير مكونات ذات نسبة بروتين أعلى وأخرى أقل من النسبة المستهدفة لتحقيق التوازن');
    }

    // اختيار المكون الأكثر كفاءة اقتصادية من كل فئة (أقل تكلفة لكل 1% بروتين)
    const bestHigh = highProtein.reduce((prev, curr) => 
      (curr.costPerKg / curr.proteinPct) < (prev.costPerKg / prev.proteinPct) ? curr : prev
    );

    const bestLow = lowProtein.reduce((prev, curr) => 
      (curr.costPerKg / curr.proteinPct) < (prev.costPerKg / prev.proteinPct) ? curr : prev
    );

    // معادلة مربع بيرسون (Pearson Square Method)
    const partsHigh = Math.abs(target.targetProteinPct - bestLow.proteinPct);
    const partsLow = Math.abs(bestHigh.proteinPct - target.targetProteinPct);
    const totalParts = partsHigh + partsLow;

    const highRatio = totalParts > 0 ? partsHigh / totalParts : 0.5;
    const lowRatio = totalParts > 0 ? partsLow / totalParts : 0.5;

    const highKg = Money.roundDecimal(target.batchTotalKg * highRatio, 2).toNumber();
    const lowKg = Money.roundDecimal(target.batchTotalKg * lowRatio, 2).toNumber();

    const costHigh = Money.multiply(highKg, bestHigh.costPerKg);
    const costLow = Money.multiply(lowKg, bestLow.costPerKg);
    const totalCostDecimal = Money.add(costHigh, costLow);
    const totalCost = Money.roundDecimal(totalCostDecimal, 3).toNumber();
    const costPerKg = Money.roundDecimal(Money.divide(totalCostDecimal, target.batchTotalKg), 3).toNumber();

    const actualProteinPct = Money.roundDecimal(
      (highRatio * bestHigh.proteinPct) + (lowRatio * bestLow.proteinPct),
      2
    ).toNumber();

    return {
      targetProteinPct: target.targetProteinPct,
      actualProteinPct,
      batchTotalKg: target.batchTotalKg,
      totalCost,
      costPerKg,
      costPerTon: Money.roundDecimal(Money.multiply(costPerKg, 1000), 2).toNumber(),
      items: [
        {
          ingredientId: bestHigh.id,
          name: bestHigh.name,
          percentage: Money.roundDecimal(highRatio * 100, 2).toNumber(),
          weightKg: highKg,
          cost: Money.roundDecimal(costHigh, 2).toNumber(),
        },
        {
          ingredientId: bestLow.id,
          name: bestLow.name,
          percentage: Money.roundDecimal(lowRatio * 100, 2).toNumber(),
          weightKg: lowKg,
          cost: Money.roundDecimal(costLow, 2).toNumber(),
        },
      ],
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

      const updateData: Prisma.FeedIngredientUpdateInput = { currentStock: { increment: addedKg } };
      if (costPerUnit !== undefined) updateData.costPerUnit = costPerUnit;
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

