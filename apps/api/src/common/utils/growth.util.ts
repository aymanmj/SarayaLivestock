import { Money, MoneyValue } from './money.util';
import Decimal from 'decimal.js';

export class GrowthEngine {
  /**
   * حساب معدل الزيادة اليومية في الوزن (Average Daily Gain - ADG)
   * ADG (كجم/يوم) = (الوزن الحالي - الوزن السابق) / عدد الأيام
   */
  static calculateAdg(currentWeightKg: number, previousWeightKg: number, daysBetween: number): number {
    if (daysBetween <= 0) return 0;
    const gain = Money.decimal(currentWeightKg).minus(Money.decimal(previousWeightKg));
    return gain.div(daysBetween).toDecimalPlaces(3, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /**
   * حساب معامل التحويل الغذائي (Feed Conversion Ratio - FCR)
   * FCR = كمية العلف المستهلكة (كجم) / الوزن المكتسب (كجم)
   */
  static calculateFcr(totalFeedKg: number, totalWeightGainKg: number): number {
    const gain = Money.decimal(totalWeightGainKg);
    if (gain.lte(0)) return 0;
    return Money.decimal(totalFeedKg).div(gain).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /**
   * حساب تكلفة كجم اللحم المكتسب (Cost Per Kg Gain)
   * التكلفة = إجمالي التكاليف المباشرة والتشغيلية / الوزن المكتسب
   */
  static calculateCostPerKgGain(totalCosts: MoneyValue, totalWeightGainKg: number): number {
    if (totalWeightGainKg <= 0) return 0;
    return Money.divide(totalCosts, totalWeightGainKg).toDecimalPlaces(3, Decimal.ROUND_HALF_EVEN).toNumber();
  }
}
