import { Money } from './money.util';
import Decimal from 'decimal.js';

describe('Money Utility', () => {
  it('should handle floating point addition correctly without precision loss', () => {
    // Standard JS: 0.1 + 0.2 = 0.30000000000000004
    const result = Money.add(0.1, 0.2);
    expect(result.toString()).toBe('0.3');
    expect(Money.toDb(result)).toBe(0.3);
  });

  it('should accurately multiply prices with scale 3', () => {
    // 12.345 kg of feed * $0.456 per kg
    const cost = Money.multiply(12.345, 0.456);
    expect(Money.toDb(cost)).toBe(5.629);
  });

  it('should handle division correctly', () => {
    // $1000 total cost / 400 liters = $2.5 / liter
    const costPerLiter = Money.divide(1000, 400);
    expect(costPerLiter.toNumber()).toBe(2.5);
  });

  it('should throw on division by zero', () => {
    expect(() => Money.divide(1000, 0)).toThrow('Division by zero in Money calculation');
  });
});
