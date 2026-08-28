import Decimal from 'decimal.js';

export type MoneyValue = Decimal.Value | null | undefined;

export const MONEY_SCALE = 3;

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export const OFFICIAL_CURRENCY = {
  code: 'LYD',
  symbol: 'د.ل',
  nameAr: 'دينار ليبي',
  nameEn: 'Libyan Dinar',
  decimals: 3,
  subUnit: 'درهم',
};

export class Money {
  static decimal(value: MoneyValue = 0): Decimal {
    return new Decimal(value ?? 0);
  }

  static roundDecimal(value: MoneyValue, decimals = MONEY_SCALE): Decimal {
    return Money.decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  }

  static toDb(value: MoneyValue): number {
    return Money.roundDecimal(value, MONEY_SCALE).toNumber();
  }

  static add(...values: MoneyValue[]): Decimal {
    return values.reduce<Decimal>((total, value) => total.plus(Money.decimal(value)), new Decimal(0));
  }

  static sub(a: MoneyValue, b: MoneyValue): Decimal {
    return Money.decimal(a).minus(Money.decimal(b));
  }

  static multiply(a: MoneyValue, b: MoneyValue): Decimal {
    return Money.decimal(a).mul(Money.decimal(b));
  }

  static divide(a: MoneyValue, b: MoneyValue): Decimal {
    const divisor = Money.decimal(b);
    if (divisor.isZero()) throw new Error('Division by zero in Money calculation');
    return Money.decimal(a).div(divisor);
  }

  static format(amount: MoneyValue, decimals: number = 2): string {
    const num = Money.decimal(amount).toNumber();
    return `${num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${OFFICIAL_CURRENCY.symbol}`;
  }
}
