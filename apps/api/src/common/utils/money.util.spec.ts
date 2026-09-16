import { Money } from './money.util';
import Decimal from 'decimal.js';

describe('Money Utility', () => {
  it('should handle floating point addition correctly without precision loss', () => {
    // Standard JS: 0.1 + 0.2 = 0.30000000000000004
    const result = Money.add(0.1, 0.2);
    expect(result.toString()).toBe('0.3');
    expect(Money.toDb(result)).toBe('0.300');
  });

  it('should accurately multiply prices with scale 3', () => {
    // 12.345 kg of feed * $0.456 per kg
    const cost = Money.multiply(12.345, 0.456);
    expect(Money.toDb(cost)).toBe('5.629');
  });

  it('should handle division correctly', () => {
    // $1000 total cost / 400 liters = $2.5 / liter
    const costPerLiter = Money.divide(1000, 400);
    expect(costPerLiter.toNumber()).toBe(2.5);
  });

  it('should throw on division by zero', () => {
    expect(() => Money.divide(1000, 0)).toThrow('Division by zero in Money calculation');
  });

  it('should support fluent MoneyChain operations without float drift', () => {
    const chainResult = Money.from('1000')
      .sub('250.555')
      .rate('0.15')
      .add('50.123')
      .round(3);

    expect(chainResult.toDb()).toBe('162.540');
    expect(chainResult.to3dp()).toBe(162.540);
    expect(chainResult.toFixed(3)).toBe('162.540');
  });

  it('should format money with standard Latin numerals and Libyan Dinar symbol', () => {
    const { formatMoney, parseMoney, OFFICIAL_CURRENCY } = require('./money.util');
    expect(OFFICIAL_CURRENCY.code).toBe('LYD');
    expect(OFFICIAL_CURRENCY.decimals).toBe(3);

    expect(formatMoney(1450.75, true, 3)).toBe('1,450.750 د.ل');
    expect(formatMoney(1450.75, false, 2)).toBe('1,450.75');
    expect(parseMoney('1,450.750 د.ل')).toBe(1450.75);
    expect(parseMoney(null)).toBe(0);
  });

  it('should provide robust number, date, string, and validation utilities', () => {
    const { NumberUtils, DateUtils, StringUtils, ValidationUtils } = require('./money.util');

    expect(NumberUtils.clamp(150, 0, 100)).toBe(100);
    expect(NumberUtils.isBetween(50, 10, 90)).toBe(true);

    const testDate = new Date('2026-09-16T10:00:00Z');
    expect(DateUtils.toISO(testDate)).toBe('2026-09-16');

    expect(StringUtils.generateCode('ANM', 42, 5)).toBe('ANM-00042');
    expect(StringUtils.slugify('Livestock Farm 2026!')).toBe('livestock-farm-2026');

    expect(ValidationUtils.isValidEmail('test@saraya.ly')).toBe(true);
    expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
  });
});
