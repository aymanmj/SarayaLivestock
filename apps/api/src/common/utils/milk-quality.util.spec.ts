import { MilkQualityEngine } from './milk-quality.util';

describe('Milk Quality Engine', () => {
  it('should detect yield drop anomaly when production drops below threshold (-15%)', () => {
    // 7-day average: 30 Liters. Today: 22 Liters -> (22 - 30) / 30 = -26.67%
    const result = MilkQualityEngine.detectYieldDropAnomaly(22, 30);
    expect(result.hasAnomaly).toBe(true);
    expect(result.dropPercentage).toBe(-26.67);
  });

  it('should not trigger anomaly when production is normal or minor drop', () => {
    // 7-day average: 30 Liters. Today: 28 Liters -> (28 - 30) / 30 = -6.67%
    const result = MilkQualityEngine.detectYieldDropAnomaly(28, 30);
    expect(result.hasAnomaly).toBe(false);
    expect(result.dropPercentage).toBe(-6.67);
  });

  it('should adjust milk price based on fat and protein bonuses', () => {
    const config = {
      basePricePerLiter: 0.50, // $0.50 base
      baseFatPct: 3.5,
      baseProteinPct: 3.2,
      fatBonusPerPoint: 0.005, // +$0.005 for each 0.1% fat
      proteinBonusPerPoint: 0.004,
      sccPenaltyThreshold: 400000,
    };

    // Actual: Fat 3.9% (+0.4% = 4 points = +$0.02), Protein 3.4% (+0.2% = 2 points = +$0.008)
    const adjustedPrice = MilkQualityEngine.calculateAdjustedMilkPrice(3.9, 3.4, config);
    // 0.50 + 0.02 + 0.008 = 0.528
    expect(adjustedPrice).toBe(0.528);
  });
});
