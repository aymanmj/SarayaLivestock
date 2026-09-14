// packages/shared-utils/src/money.ts
// مكتبة الحسابات المالية الدقيقة - نسخة معممة متعددة العملات

import Decimal from 'decimal.js';

// A private constructor prevents unrelated Decimal consumers from changing financial policy.
// Preserve small intermediate rates and large totals; round only at explicit boundaries.
const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  minE: -9e15,
  maxE: 9e15,
});

export type MoneyValue = number | string | Decimal;

function moneyDecimal(value: MoneyValue): Decimal {
  const result = new FinancialDecimal(value);
  if (!result.isFinite()) throw new RangeError('Money requires a finite decimal value');
  return result;
}

/** إعدادات العملة */
export interface CurrencyConfig {
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string;
  decimals: number; // عدد الخانات العشرية (2 لمعظم العملات، 3 للدينار)
  subUnitNameAr: string; // اسم الوحدة الفرعية (قرش، درهم، هللة)
  subUnitNameEn: string;
}

/** العملات المدعومة */
export const CURRENCIES: Record<string, CurrencyConfig> = {
  SDG: { code: 'SDG', nameAr: 'جنيه سوداني', nameEn: 'Sudanese Pound', symbol: 'ج.س', decimals: 2, subUnitNameAr: 'قرش', subUnitNameEn: 'Qirsh' },
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', decimals: 2, subUnitNameAr: 'هللة', subUnitNameEn: 'Halala' },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', decimals: 2, subUnitNameAr: 'فلس', subUnitNameEn: 'Fils' },
  EGP: { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', decimals: 2, subUnitNameAr: 'قرش', subUnitNameEn: 'Piastre' },
  LYD: { code: 'LYD', nameAr: 'دينار ليبي', nameEn: 'Libyan Dinar', symbol: 'د.ل', decimals: 3, subUnitNameAr: 'درهم', subUnitNameEn: 'Dirham' },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3, subUnitNameAr: 'فلس', subUnitNameEn: 'Fils' },
  USD: { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', decimals: 2, subUnitNameAr: 'سنت', subUnitNameEn: 'Cent' },
  EUR: { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', decimals: 2, subUnitNameAr: 'سنت', subUnitNameEn: 'Cent' },
};

/**
 * 💰 Money Utility Class
 * فئة مساعدة لإجراء العمليات الحسابية المالية بدقة عالية
 * تستخدم مكتبة decimal.js لتجنب أخطاء الأرقام العشرية في JavaScript
 */
export class Money {
  /** Exact decimal operations for ledger/database code; call toFixed at storage boundaries.
   * Numeric helpers retain their existing number return type for API/UI compatibility.
   */
  static decimal(value: MoneyValue): Decimal { return moneyDecimal(value); }

  static decimalMin(...values: MoneyValue[]): Decimal {
    if (!values.length) throw new RangeError('Money.decimalMin requires values');
    return FinancialDecimal.min(...values.map(moneyDecimal));
  }

  static decimalMax(...values: MoneyValue[]): Decimal {
    if (!values.length) throw new RangeError('Money.decimalMax requires values');
    return FinancialDecimal.max(...values.map(moneyDecimal));
  }

  static toFixed(value: MoneyValue, decimals = 3): string {
    return moneyDecimal(value).toFixed(decimals, Decimal.ROUND_HALF_UP);
  }

  // ======================== العمليات الأساسية ========================

  /** جمع قيمتين */
  static add(a: MoneyValue, b: MoneyValue): number {
    return moneyDecimal(a).plus(moneyDecimal(b)).toNumber();
  }

  /** طرح قيمتين: a - b */
  static sub(a: MoneyValue, b: MoneyValue): number {
    return moneyDecimal(a).minus(moneyDecimal(b)).toNumber();
  }

  /** ضرب قيمتين */
  static mul(a: MoneyValue, b: MoneyValue): number {
    return moneyDecimal(a).times(moneyDecimal(b)).toNumber();
  }

  /** قسمة: a / b */
  static div(a: MoneyValue, b: MoneyValue): number {
    if (moneyDecimal(b).isZero()) {
      throw new Error('Division by zero');
    }
    return moneyDecimal(a).div(moneyDecimal(b)).toNumber();
  }

  // ======================== عمليات متقدمة ========================

  /** جمع مصفوفة من القيم */
  static sum(...values: MoneyValue[]): number {
    return values
      .reduce<Decimal>((acc, val) => acc.plus(moneyDecimal(val)), moneyDecimal(0))
      .toNumber();
  }

  /** حساب النسبة المئوية: (amount * percent / 100) */
  static percent(amount: MoneyValue, percent: MoneyValue): number {
    return moneyDecimal(amount).times(moneyDecimal(percent)).div(100).toNumber();
  }

  /** حساب النسبة كعامل: (amount * rate) حيث rate عدد عشري مثل 0.15 */
  static rate(amount: MoneyValue, rateValue: MoneyValue): number {
    return moneyDecimal(amount).times(moneyDecimal(rateValue)).toNumber();
  }

  /** حساب المتبقي: base - deduction */
  static remaining(base: MoneyValue, deduction: MoneyValue): number {
    return Money.sub(base, deduction);
  }

  // ======================== التقريب والتنسيق ========================

  /** تقريب حسب عدد خانات العملة */
  static toCurrency(amount: MoneyValue, currencyCode: string = 'SDG'): number {
    const decimals = CURRENCIES[currencyCode]?.decimals ?? 2;
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** تقريب لـ 2 خانات عشرية */
  static to2dp(amount: MoneyValue): number {
    return moneyDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** تقريب لـ 3 خانات عشرية */
  static to3dp(amount: MoneyValue): number {
    return moneyDecimal(amount).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** تقريب لعدد مخصص من الخانات */
  static round(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** تقريب لأعلى */
  static ceil(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_UP).toNumber();
  }

  /** تقريب لأسفل */
  static floor(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_DOWN).toNumber();
  }

  // ======================== المقارنات ========================

  static eq(a: MoneyValue, b: MoneyValue): boolean {
    return moneyDecimal(a).equals(moneyDecimal(b));
  }

  static gt(a: MoneyValue, b: MoneyValue): boolean {
    return moneyDecimal(a).greaterThan(moneyDecimal(b));
  }

  static gte(a: MoneyValue, b: MoneyValue): boolean {
    return moneyDecimal(a).greaterThanOrEqualTo(moneyDecimal(b));
  }

  static lt(a: MoneyValue, b: MoneyValue): boolean {
    return moneyDecimal(a).lessThan(moneyDecimal(b));
  }

  static lte(a: MoneyValue, b: MoneyValue): boolean {
    return moneyDecimal(a).lessThanOrEqualTo(moneyDecimal(b));
  }

  static isZero(amount: MoneyValue): boolean {
    return moneyDecimal(amount).isZero();
  }

  static isPositive(amount: MoneyValue): boolean {
    return moneyDecimal(amount).gt(0);
  }

  static isNegative(amount: MoneyValue): boolean {
    return moneyDecimal(amount).lt(0);
  }

  // ======================== دوال مساعدة للأعمال ========================

  /** حساب الإجمالي مع الضريبة */
  static withTax(amount: MoneyValue, taxRate: MoneyValue): number {
    const tax = Money.rate(amount, taxRate);
    return Money.add(amount, tax);
  }

  /** حساب الصافي بعد الخصم */
  static withDiscount(amount: MoneyValue, discountRate: MoneyValue): number {
    const discount = Money.rate(amount, discountRate);
    return Money.sub(amount, discount);
  }

  /** سعر الوحدة */
  static unitPrice(totalAmount: MoneyValue, quantity: MoneyValue): number {
    return Money.div(totalAmount, quantity);
  }

  /** إجمالي السطر */
  static lineTotal(unitPrice: MoneyValue, quantity: MoneyValue, currencyCode: string = 'SDG'): number {
    return Money.toCurrency(Money.mul(unitPrice, quantity), currencyCode);
  }

  /** المعدل اليومي: monthlyAmount / 30 */
  static dailyRate(monthlyAmount: MoneyValue): number {
    return Money.div(monthlyAmount, 30);
  }

  /** المعدل بالساعة: dailyRate / 8 */
  static hourlyRate(dailyAmount: MoneyValue): number {
    return Money.div(dailyAmount, 8);
  }

  /** المعدل بالدقيقة */
  static minuteRate(hourlyAmount: MoneyValue): number {
    return Money.div(hourlyAmount, 60);
  }

  /** حساب ساعة إضافية عادية: (الراتب / 30 / 8) × المضاعف */
  static overtimeHourly(monthlySalary: MoneyValue, multiplier: number = 1.5): number {
    const daily = Money.dailyRate(monthlySalary);
    const hourly = Money.hourlyRate(daily);
    return Money.mul(hourly, multiplier);
  }

  /** تنسيق المبلغ مع رمز العملة */
  static format(amount: MoneyValue, currencyCode: string = 'SDG'): string {
    const config = CURRENCIES[currencyCode];
    const decimals = config?.decimals ?? 2;
    const symbol = config?.symbol ?? currencyCode;
    return `${Money.toFixed(amount, decimals)} ${symbol}`;
  }

  /** تحويل Prisma Decimal إلى number */
  static fromPrisma(value: { toNumber(): number } | null | undefined): number {
    return value?.toNumber() ?? 0;
  }

  /** إنشاء كائن Money للعمليات المتسلسلة */
  static multiply(a: MoneyValue, b: MoneyValue): Decimal { return moneyDecimal(a).times(moneyDecimal(b)); }

  static divide(a: MoneyValue, b: MoneyValue): Decimal {
    const divisor = moneyDecimal(b);
    if (divisor.isZero()) throw new Error('Division by zero in Money calculation');
    return moneyDecimal(a).div(divisor);
  }

  static toDb(value: MoneyValue): number {
    return moneyDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  }

  static roundDecimal(amount: MoneyValue, decimals: number = 3): Decimal { return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP); }

  static from(value: MoneyValue): MoneyChain {
    return new MoneyChain(value);
  }
}

/**
 * 🔗 MoneyChain - عمليات متسلسلة (Fluent API)
 * @example
 * Money.from(1000).sub(100).rate(0.15).add(50).to2dp()
 */
export class MoneyChain {
  private value: Decimal;

  constructor(initial: MoneyValue) {
    this.value = moneyDecimal(initial);
  }

  add(amount: MoneyValue): MoneyChain {
    this.value = this.value.plus(moneyDecimal(amount));
    return this;
  }

  sub(amount: MoneyValue): MoneyChain {
    this.value = this.value.minus(moneyDecimal(amount));
    return this;
  }

  mul(amount: MoneyValue): MoneyChain {
    this.value = this.value.times(moneyDecimal(amount));
    return this;
  }

  div(amount: MoneyValue): MoneyChain {
    if (moneyDecimal(amount).isZero()) throw new Error('Division by zero');
    this.value = this.value.div(moneyDecimal(amount));
    return this;
  }

  rate(rateValue: MoneyValue): MoneyChain {
    this.value = this.value.times(moneyDecimal(rateValue));
    return this;
  }

  percent(percentValue: MoneyValue): MoneyChain {
    this.value = this.value.times(moneyDecimal(percentValue)).div(100);
    return this;
  }

  round(decimals: number = 3): MoneyChain {
    this.value = this.value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    return this;
  }

  toFixed(decimals = 3): string {
    return this.value.toFixed(decimals, Decimal.ROUND_HALF_UP);
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  to2dp(): number {
    return this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  to3dp(): number {
    return this.value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  }

  toCurrency(currencyCode: string = 'SDG'): number {
    const decimals = CURRENCIES[currencyCode]?.decimals ?? 2;
    return this.value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
  }
}




