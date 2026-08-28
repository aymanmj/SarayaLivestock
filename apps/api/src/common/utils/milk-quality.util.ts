import { Money, MoneyValue } from './money.util';
import Decimal from 'decimal.js';

export interface MilkPriceAdjustmentConfig {
  basePricePerLiter: number;     // السعر الأساسي للتر
  baseFatPct: number;             // نسبة الدهن القياسية (مثلاً 3.5%)
  baseProteinPct: number;         // نسبة البروتين القياسية (مثلاً 3.2%)
  fatBonusPerPoint: number;       // علاوة لكل 0.1% زيادة دهن
  proteinBonusPerPoint: number;   // علاوة لكل 0.1% زيادة بروتين
  sccPenaltyThreshold: number;    // حد الخلايا الجسدية (SCC) لبدء الخصم
}

export class MilkQualityEngine {
  /**
   * كشف الانخفاض غير الطبيعي في إنتاج الحليب (مؤشر صحي/بيطري مبكر)
   * إذا انخفض إنتاج اليوم عن متوسط الـ 7 أيام السابقة بنسبة > 15%
   */
  static detectYieldDropAnomaly(todayYield: number, past7DaysAverage: number, thresholdPct = -15): {
    hasAnomaly: boolean;
    dropPercentage: number;
  } {
    if (past7DaysAverage <= 0) return { hasAnomaly: false, dropPercentage: 0 };
    
    const drop = new Decimal(todayYield)
      .minus(past7DaysAverage)
      .div(past7DaysAverage)
      .mul(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    return {
      hasAnomaly: drop <= thresholdPct,
      dropPercentage: drop,
    };
  }

  /**
   * حساب سعر لتر الحليب الفعلي مع علاوات وخصومات الجودة
   */
  static calculateAdjustedMilkPrice(
    actualFatPct: number,
    actualProteinPct: number,
    config: MilkPriceAdjustmentConfig
  ): number {
    let price = new Decimal(config.basePricePerLiter);

    // تعديل الدهن
    if (actualFatPct) {
      const fatDiff = new Decimal(actualFatPct).minus(config.baseFatPct);
      price = price.plus(fatDiff.mul(10).mul(config.fatBonusPerPoint));
    }

    // تعديل البروتين
    if (actualProteinPct) {
      const proteinDiff = new Decimal(actualProteinPct).minus(config.baseProteinPct);
      price = price.plus(proteinDiff.mul(10).mul(config.proteinBonusPerPoint));
    }

    // عدم السماح بسعر سلبي
    if (price.lt(0)) price = new Decimal(0);

    return price.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * حساب تكلفة لتر الحليب الفعلية (Real Cost per Liter)
   */
  static calculateCostPerLiter(totalCosts: MoneyValue, totalSoldLiters: number): number {
    if (totalSoldLiters <= 0) return 0;
    return Money.divide(totalCosts, totalSoldLiters).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  }
}
