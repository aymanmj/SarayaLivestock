import { GrowthEngine } from './growth.util';

describe('Growth Engine', () => {
  it('should calculate ADG accurately', () => {
    // A bull went from 200 kg to 245 kg over 30 days (45 kg gain / 30 days = 1.5 kg/day)
    const adg = GrowthEngine.calculateAdg(245, 200, 30);
    expect(adg).toBe(1.5);
  });

  it('should calculate FCR accurately', () => {
    // Consumed 300 kg feed for 50 kg weight gain -> 300 / 50 = 6.0
    const fcr = GrowthEngine.calculateFcr(300, 50);
    expect(fcr).toBe(6);
  });

  it('should calculate cost per kg gain', () => {
    // Total costs $150 for 50 kg gain -> $3.00 / kg gain
    const costPerKg = GrowthEngine.calculateCostPerKgGain(150, 50);
    expect(costPerKg).toBe(3);
  });
});
