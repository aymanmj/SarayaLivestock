import Decimal from 'decimal.js';
import * as ApiMoney from './money.util';
import * as WebMoney from '../../../../web/src/utils/money.util';

describe.each([['api', ApiMoney], ['web', WebMoney]] as const)('shared financial contract: %s', (_name, utils) => {
const { Money, NumberUtils, formatMoney, formatNumber, formatPercent, parseMoney, DateUtils } = utils;

describe('shared financial arithmetic', () => {
  it('rounds each LYD line before summing a document', () => {
    expect(Money.lineTotal('0.567', '1.234', 'LYD')).toBe(0.7);
    expect(Money.sum(Money.lineTotal('0.567', '1.234', 'LYD'), Money.lineTotal('0.567', '1.234', 'LYD'))).toBe(1.4);
    expect(Money.add(0.1, 0.2)).toBe(0.3);
    expect(Money.sub(0.3, 0.1)).toBe(0.2);
  });

  it('keeps large values and small intermediate rates finite and exact as decimals', () => {
    expect(Money.add('10000000000', '0.001')).toBe(10000000000.001);
    expect(Money.decimal('0.0000000001').mul('10000000000').toString()).toBe('1');
    expect(Money.from('999999999999999.998').add('0.001').toFixed()).toBe('999999999999999.999');
  });

  it('uses symmetric half-even rounding for postings and formatted amounts', () => {
    expect(Money.toFixed('1.2345')).toBe('1.234');
    expect(Money.toFixed('-1.2345')).toBe('-1.234');
    expect(Money.format('1.005', 'USD')).toBe('1.00 $');
    expect(Money.toCurrency('1.2345', 'LYD')).toBe(1.234);
  });

  it('is independent of other Decimal consumers changing their precision', () => {
    const precision = Decimal.precision;
    try {
      Decimal.set({ precision: 5 });
      expect(Money.add('123456.789', '0.001')).toBe(123456.79);
      expect(Money.decimal('123456.789').plus('0.001').toFixed(3)).toBe('123456.790');
    } finally { Decimal.set({ precision }); }
  });

  it.each([NaN, Infinity, -Infinity, 'NaN', 'Infinity'])('rejects invalid financial input %s', value => {
    expect(() => Money.add(value, 1)).toThrow('finite');
  });

  it('rejects division by zero in both interfaces and excludes zero from positive values', () => {
    expect(() => Money.div(1, 0)).toThrow('Division by zero');
    expect(() => Money.from(1).div(0)).toThrow('Division by zero');
    expect(Money.isPositive(0)).toBe(false);
    expect(Money.isNegative('-0')).toBe(false);
  });

  it('provides high-precision Decimal preservation without intermediate float drift', () => {
    const decProduct = Money.multiply('12.345', '0.456');
    expect(Decimal.isDecimal(decProduct)).toBe(true);
    expect(Money.toDb(decProduct)).toBe('5.629');

    const decQuotient = Money.divide(1000, 400);
    expect(Decimal.isDecimal(decQuotient)).toBe(true);
    expect(decQuotient.toNumber()).toBe(2.5);

    expect(() => Money.divide(1000, 0)).toThrow('Division by zero in Money calculation');
  });

  it('supports unified money formatting and parsing with standard Latin digits', () => {
    const { formatMoney, parseMoney, OFFICIAL_CURRENCY } = utils;
    expect(OFFICIAL_CURRENCY.code).toBe('LYD');
    expect(formatMoney(1250.5, true, 3)).toBe('1,250.500 د.ل');
    expect(formatMoney(1250.5, false, 2)).toBe('1,250.50');
    expect(parseMoney('1,250.500 د.ل')).toBe(1250.5);
    expect(parseMoney(null)).toBe(0);
  });
});

describe('LYD defaults and exact financial boundaries', () => {
  it.each([
    ['1.2345', '1.234'], ['1.2355', '1.236'],
    ['-1.2345', '-1.234'], ['-1.2355', '-1.236'],
    ['0.0005', '0.000'], ['0.0015', '0.002'],
    ['1.23450001', '1.235'], ['1.23449999', '1.234'],
    ['9.9995', '10.000'],
  ])('uses bankers rounding consistently for %s', (value, expected) => {
    expect(Money.toDb(value)).toBe(expected);
    expect(Money.toFixed(value)).toBe(expected);
    expect(Money.roundDecimal(value).toFixed(3)).toBe(expected);
    expect(Money.from(value).round().toDb()).toBe(expected);
    expect(Money.toCurrency(value)).toBe(Number(expected));
    expect(formatMoney(value, false)).toBe(expected);
    expect(formatPercent(value)).toBe(`${expected}%`);
  });

  it('sums posted line values and reverses the exact original posted amount', () => {
    const lines = ['1.2345', '1.2355'].map(value => Money.toDb(value));
    const total = Money.from(0).add(lines[0]).add(lines[1]);
    expect(total.toDb()).toBe('2.470');
    expect(total.sub('2.470').toDb()).toBe('0.000');
    expect(Money.from('1.234').add(Money.decimal('1.234').negated()).toDb()).toBe('0.000');
  });

  it('defaults currency conversions, lines and formatting to LYD with three decimals', () => {
    expect(Money.toCurrency('1.2345')).toBe(1.234);
    expect(Money.from('1.2345').toCurrency()).toBe(1.234);
    expect(Money.lineTotal('1.234', 1)).toBe(1.234);
    expect(Money.format('1.2345')).toBe('1.234 د.ل');
    expect(Money.round('1.2345')).toBe(1.234);
    expect(Money.from('1.2345').round().toFixed()).toBe('1.234');
    expect(formatNumber('1.2345')).toBe('1.234');
    expect(formatPercent('1.2345')).toBe('1.234%');
    expect(NumberUtils.formatCurrency('1.2345')).toBe('1.234 د.ل');
    expect(Money.toCurrency('1.235', 'USD')).toBe(1.24);
  });

  it('preserves the full Decimal(18,3) range at storage and display boundaries', () => {
    const value = '999999999999999.999';
    expect(Money.toDb(value)).toBe(value);
    expect(Money.from(value).toDb()).toBe(value);
    expect(formatMoney(value)).toBe('999,999,999,999,999.999 د.ل');
    expect(NumberUtils.formatCurrency(value)).toBe('999,999,999,999,999.999 د.ل');
    expect(Money.toDb('-1.2345')).toBe('-1.234');
  });

  it('preserves intermediate decimals until rounding, independently of global Decimal settings', () => {
    const precision = Decimal.precision;
    try {
      Decimal.set({ precision: 5 });
      expect(Money.multiply('123456789.123456789', '10').toFixed(8)).toBe('1234567891.23456789');
      expect(Money.divide(1, 3).times(3).toFixed(30)).toBe('1.000000000000000000000000000000');
      expect(Money.roundDecimal('-1.2345').toFixed(3)).toBe('-1.234');
      expect(Money.from('123456789.123456789').decimal().toFixed(9)).toBe('123456789.123456789');
      expect(Money.from('-1.2345').roundDecimal().toFixed(3)).toBe('-1.234');
    } finally { Decimal.set({ precision }); }
  });

  it('rounds percentages and negative ceil/floor consistently', () => {
    expect(formatPercent('1.005', 2)).toBe('1.00%');
    expect(formatPercent('-1.005', 2)).toBe('-1.00%');
    expect(Money.ceil('-1.2345')).toBe(-1.234);
    expect(Money.floor('-1.2345')).toBe(-1.235);
    expect(formatPercent(0 / 0)).toBe('-');
    expect(formatPercent(Infinity)).toBe('-');
    expect(formatMoney('-0.1235')).toBe('-0.124 د.ل');
    expect(formatMoney('-0.0001')).toBe('0.000 د.ل');
    expect(NumberUtils.formatCurrency('999999999999999.995', 'USD')).toBe('$1,000,000,000,000,000.00');
  });

  it.each(['1,250.500 د.ل', '١٬٢٥٠٫٥٠٠ د.ل', '۱٬۲۵۰٫۵۰۰ LYD', '1.2505e3'])('parses and formats the entire valid input %s', value => {
    expect(parseMoney(value)).toBe(1250.5);
    expect(formatMoney(value)).toBe('1,250.500 د.ل');
  });

  it.each(['12.3.4', '1,25', '12abc', '1-2', 'د.ل', NaN, Infinity, '-Infinity'])('rejects malformed and non-finite input %s', value => {
    expect(() => parseMoney(value)).toThrow();
    expect(() => formatMoney(value)).toThrow();
  });

  it('refuses lossy conversion to number while retaining empty-field compatibility', () => {
    expect(() => parseMoney('999999999999999.999')).toThrow();
    expect(() => parseMoney('1e1000')).toThrow();
    expect(() => parseMoney('1e-1000')).toThrow();
    expect(parseMoney('')).toBe(0);
    expect(parseMoney(null)).toBe(0);
    expect(formatMoney(undefined)).toBe('0.000 د.ل');
    expect(parseMoney('1e3')).toBe(1000);
  });

  it('accepts legacy locale arguments while keeping Latin digits', () => {
    expect(NumberUtils.formatNumber(1234.567, 'ar')).toContain('234');
    expect(NumberUtils.formatNumber(1234.567, 'ar')).not.toMatch(/[٠-٩۰-۹]/);
    expect(NumberUtils.formatNumber(1234.567, 2)).toBe('1,234.57');
    expect(DateUtils.format(new Date('2026-09-16T10:20:00Z'))).not.toMatch(/[٠-٩۰-۹]/);
  });
});
});

import { GrowthEngine } from './growth.util';
import { MilkQualityEngine } from './milk-quality.util';
describe('livestock cost boundaries use bankers rounding', () => {
  it('rounds dairy and growth costs with the shared policy', () => {
    expect(GrowthEngine.calculateCostPerKgGain('1.2345', 1)).toBe(1.234);
    expect(MilkQualityEngine.calculateCostPerLiter('1.2345', 1)).toBe(1.234);
    expect(MilkQualityEngine.calculateAdjustedMilkPrice(0, 0, { basePricePerLiter: 1.2345, baseFatPct: 3.5, baseProteinPct: 3.2, fatBonusPerPoint: 0, proteinBonusPerPoint: 0, sccPenaltyThreshold: 400000 })).toBe(1.234);
  });
});
