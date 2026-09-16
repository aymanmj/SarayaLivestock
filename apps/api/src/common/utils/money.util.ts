// Synced from SarayaManager/packages/shared-utils/src. Keep API and web copies identical.
// packages/shared-utils/src/money.ts
// مكتبة الحسابات المالية الدقيقة - نسخة معممة متعددة العملات

import Decimal from 'decimal.js';

// A private constructor prevents unrelated Decimal consumers from changing financial policy.
// Preserve small intermediate rates and large totals; round only at explicit boundaries.
const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
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

/** Shared default for monetary amounts and measured quantities. */
export const OFFICIAL_CURRENCY = Object.freeze({
  ...CURRENCIES.LYD,
  subUnit: CURRENCIES.LYD.subUnitNameAr,
});

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
    return moneyDecimal(value).toFixed(decimals, Decimal.ROUND_HALF_EVEN);
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
  static toCurrency(amount: MoneyValue, currencyCode: string = OFFICIAL_CURRENCY.code): number {
    const decimals = CURRENCIES[currencyCode]?.decimals ?? OFFICIAL_CURRENCY.decimals;
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /** تقريب لـ 2 خانات عشرية */
  static to2dp(amount: MoneyValue): number {
    return moneyDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /** تقريب لـ 3 خانات عشرية */
  static to3dp(amount: MoneyValue): number {
    return moneyDecimal(amount).toDecimalPlaces(3, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /** تقريب لعدد مخصص من الخانات (الافتراضي 3 للدينار والوحدات الزراعية والمصرفية) */
  static round(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /** تقريب لأعلى */
  static ceil(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_CEIL).toNumber();
  }

  /** تقريب لأسفل */
  static floor(amount: MoneyValue, decimals: number = 3): number {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_FLOOR).toNumber();
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
  static lineTotal(unitPrice: MoneyValue, quantity: MoneyValue, currencyCode: string = OFFICIAL_CURRENCY.code): number {
    return Money.toCurrency(Money.multiply(unitPrice, quantity), currencyCode);
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
  static format(amount: MoneyValue, currencyCode: string = OFFICIAL_CURRENCY.code): string {
    const config = CURRENCIES[currencyCode];
    const decimals = config?.decimals ?? OFFICIAL_CURRENCY.decimals;
    const symbol = config?.symbol ?? currencyCode;
    return `${Money.toFixed(amount, decimals)} ${symbol}`;
  }

  /** ضرب قيمتين وإعادة Decimal بدقة فائقة دون تحويل وسيط */
  static multiply(a: MoneyValue, b: MoneyValue): Decimal {
    return moneyDecimal(a).times(moneyDecimal(b));
  }

  /** قسمة قيمتين وإعادة Decimal بدقة فائقة مع حماية منع القسمة على صفر */
  static divide(a: MoneyValue, b: MoneyValue): Decimal {
    const divisor = moneyDecimal(b);
    if (divisor.isZero()) throw new Error('Division by zero in Money calculation');
    return moneyDecimal(a).div(divisor);
  }

  /** Exact three-place string for Prisma Decimal fields; never pass through number. */
  static toDb(value: MoneyValue): string {
    return Money.toFixed(value, OFFICIAL_CURRENCY.decimals);
  }

  /** تقريب المنتصف إلى الزوجي وإعادة Decimal للحفاظ على السلسلة الحسابية */
  static roundDecimal(amount: MoneyValue, decimals: number = 3): Decimal {
    return moneyDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN);
  }

  /** تحويل Prisma Decimal إلى number */
  static fromPrisma(value: { toNumber(): number } | null | undefined): number {
    return value?.toNumber() ?? 0;
  }

  /** إنشاء كائن Money للعمليات المتسلسلة */
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
    this.value = this.value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN);
    return this;
  }

  roundDecimal(decimals: number = 3): Decimal {
    return this.value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN);
  }

  toFixed(decimals = 3): string {
    return this.value.toFixed(decimals, Decimal.ROUND_HALF_EVEN);
  }

  toDb(): string {
    return Money.toDb(this.value);
  }

  decimal(): Decimal {
    return this.value;
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  to2dp(): number {
    return this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  to3dp(): number {
    return this.value.toDecimalPlaces(3, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  toCurrency(currencyCode: string = OFFICIAL_CURRENCY.code): number {
    return Money.toCurrency(this.value, currencyCode);
  }
}

// Shared parsing and display policy: LYD, three places, Latin digits.


type NumericInput = MoneyValue | null | undefined;

/** Accept a complete decimal, scientific notation, or a grouped LYD amount.
 * Empty form fields retain their historical zero value; malformed input throws.
 */
function inputDecimal(value: NumericInput) {
  if (value == null) return Money.decimal(0);
  if (typeof value !== 'string') return Money.decimal(value);
  let text = value.trim();
  if (!text) return Money.decimal(0);
  text = text
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/\u066b/g, '.')
    .replace(/\u066c/g, ',')
    .replace(/[\u061c\u200e\u200f]/g, '')
    .replace(/\s*(?:د\.ل|LYD)$/i, '')
    .trim();

  // Validate grouping before removing it: '1,25' must never turn into 125.
  const decimal = /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  if (!decimal.test(text)) throw new RangeError('Invalid monetary input');
  return Money.decimal(text.replace(/,/g, ''));
}

/** Format the integer as BigInt, then insert the exact rounded fraction.
 * This avoids the precision loss of converting a financial string to number.
 */
function formatExact(value: NumericInput, decimals: number, locale = 'en-US', currency?: string): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new RangeError('Display decimals must be an integer between 0 and 20');
  }
  const rounded = Money.roundDecimal(inputDecimal(value), decimals);
  const fixed = Money.toFixed(rounded.isZero() ? 0 : rounded, decimals);
  const [integer, fraction] = fixed.split('.');
  const whole = BigInt(integer);
  const formatted = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...(currency ? { style: 'currency', currency } : {}),
  });
  // BigInt has no negative zero; retain the sign of amounts between -1 and 0.
  return formatted.formatToParts(whole === 0n && integer.startsWith('-') ? -0 : whole)
    .map(part => part.type === 'fraction' ? fraction : part.value)
    .join('');
}

/** LYD amount with Latin digits, grouped thousands and exact half-even rounding. */
export function formatMoney(
  amount: NumericInput,
  includeSymbol: boolean = true,
  decimals: number = OFFICIAL_CURRENCY.decimals,
): string {
  const formatted = formatExact(amount, decimals);
  return includeSymbol ? `${formatted} ${OFFICIAL_CURRENCY.symbol}` : formatted;
}

/** Pass 0 explicitly when displaying counts rather than measured quantities. */
export function formatNumber(value: NumericInput, decimals: number = OFFICIAL_CURRENCY.decimals): string {
  return formatExact(value, decimals);
}

/** Input is already a percentage (12.5 means 12.5%, not 1250%).
 * Undefined ratios (e.g. 0 / 0 in empty reports) display as unavailable.
 */
export function formatPercent(value: NumericInput, decimals: number = OFFICIAL_CURRENCY.decimals): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return '-';
  return `${Money.toFixed(inputDecimal(value), decimals)}%`;
}

/** Numeric compatibility boundary. Reject values a number cannot preserve.
 * Use Money.decimal/plain decimal strings for exact calculations and storage.
 */
export function parseMoney(value: NumericInput): number {
  const decimal = inputDecimal(value);
  const result = decimal.toNumber();
  if (!Number.isFinite(result) || !decimal.eq(String(result))) {
    throw new RangeError('Monetary input cannot be represented safely as a number');
  }
  return result;
}

export class NumberUtils {
  /** A locale string remains supported for callers of the original API. */
  static formatNumber(value: NumericInput, decimalsOrLocale: number | string = OFFICIAL_CURRENCY.decimals): string {
    return typeof decimalsOrLocale === 'string'
      ? formatExact(value, OFFICIAL_CURRENCY.decimals, decimalsOrLocale)
      : formatNumber(value, decimalsOrLocale);
  }

  static formatPercent(value: NumericInput, decimals: number = OFFICIAL_CURRENCY.decimals): string {
    return formatPercent(value, decimals);
  }

  static formatCurrency(
    value: NumericInput,
    currency: string = OFFICIAL_CURRENCY.code,
    locale: string = 'en-US',
  ): string {
    const amount = inputDecimal(value);
    if (currency === OFFICIAL_CURRENCY.code) {
      return `${formatExact(amount, OFFICIAL_CURRENCY.decimals, locale)} ${OFFICIAL_CURRENCY.symbol}`;
    }
    const decimals = CURRENCIES[currency]?.decimals ?? OFFICIAL_CURRENCY.decimals;
    try {
      return formatExact(amount, decimals, locale, currency);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return `${formatExact(amount, decimals)} ${currency}`;
    }
  }

  static formatMoney(amount: NumericInput, includeSymbol: boolean = true, decimals: number = OFFICIAL_CURRENCY.decimals): string {
    return formatMoney(amount, includeSymbol, decimals);
  }

  static parseMoney(value: NumericInput): number {
    return parseMoney(value);
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  static isBetween(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
}

// packages/shared-utils/src/date.ts
// أدوات التاريخ المساعدة

/**
 * تنسيق التواريخ بالأرقام القياسية (YYYY-MM-DD)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** تنسيق التاريخ بالعربية */
export class DateUtils {
  /** تنسيق التاريخ الميلادي */
  static format(date: Date | string, options?: { showTime?: boolean }): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (options?.showTime === false) {
      return d.toLocaleDateString('ar', { numberingSystem: 'latn' });
    }
    return d.toLocaleString('ar', { numberingSystem: 'latn' });
  }

  /** تنسيق التاريخ بصيغة YYYY-MM-DD */
  static toISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** الفرق بين تاريخين بالأيام */
  static diffDays(start: Date | string, end: Date | string): number {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /** هل التاريخ منتهي الصلاحية؟ */
  static isExpired(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d < new Date();
  }

  /** هل سينتهي خلال عدد أيام محدد؟ */
  static isExpiringSoon(date: Date | string, daysThreshold: number = 30): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    return d <= threshold && d >= new Date();
  }

  /** بداية الشهر */
  static startOfMonth(date: Date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /** نهاية الشهر */
  static endOfMonth(date: Date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /** عدد أيام الشهر */
  static daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /** بداية السنة */
  static startOfYear(year: number): Date {
    return new Date(year, 0, 1);
  }

  /** نهاية السنة */
  static endOfYear(year: number): Date {
    return new Date(year, 11, 31);
  }

  /** أسماء الأشهر بالعربية */
  static readonly MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  /** أسماء أيام الأسبوع بالعربية */
  static readonly DAYS_AR = [
    'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
  ];

  /** اسم الشهر بالعربية */
  static monthName(month: number): string {
    return DateUtils.MONTHS_AR[month - 1] || '';
  }
}

// packages/shared-utils/src/string.ts
// أدوات النصوص المساعدة

export class StringUtils {
  /** توليد كود تلقائي مثل: EMP-00001 */
  static generateCode(prefix: string, sequence: number, padLength: number = 5): string {
    return `${prefix}-${String(sequence).padStart(padLength, '0')}`;
  }

  /** قص النص مع ... */
  static truncate(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  /** تحويل لـ slug (للروابط) */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** الاسم الكامل بالعربية */
  static fullNameAr(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  /** الاسم الكامل بالإنجليزية */
  static fullNameEn(firstName?: string, lastName?: string): string {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  /** الأحرف الأولى من الاسم (للأفاتار) */
  static initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /** هل النص فارغ أو null؟ */
  static isEmpty(value: string | null | undefined): boolean {
    return !value || value.trim().length === 0;
  }
}

// packages/shared-utils/src/validation.ts
// أدوات التحقق من البيانات

export class ValidationUtils {
  /** التحقق من صحة البريد الإلكتروني */
  static isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /** التحقق من صحة رقم الهاتف (دولي) */
  static isValidPhone(phone: string): boolean {
    const regex = /^\+?[1-9]\d{7,14}$/;
    return regex.test(phone.replace(/[\s-()]/g, ''));
  }

  /** التحقق من رقم الهوية السودانية */
  static isValidSudaneseId(id: string): boolean {
    return /^\d{11}$/.test(id.replace(/[-\s]/g, ''));
  }

  /** التحقق من IBAN */
  static isValidIBAN(iban: string): boolean {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned);
  }

  /** التحقق من قوة كلمة المرور */
  static passwordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (password.length < 6) return 'weak';
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (password.length >= 8 && score >= 3) return 'strong';
    if (password.length >= 6 && score >= 2) return 'medium';
    return 'weak';
  }

  /** التحقق أن القيمة ليست فارغة */
  static isRequired(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }
}
