import { BreedingEngine, TargetSpecies } from './breeding.util';

describe('Breeding Engine', () => {
  it('should calculate expected calving date for cattle (282 days)', () => {
    const insemination = new Date('2026-01-01');
    const expected = BreedingEngine.calculateExpectedCalvingDate(insemination, TargetSpecies.CATTLE);
    
    // 2026-01-01 + 282 days = 2026-10-10
    expect(expected.toISOString().split('T')[0]).toBe('2026-10-10');
  });

  it('should calculate expected dry-off date (60 days prior to calving for cattle)', () => {
    const insemination = new Date('2026-01-01');
    const dryOff = BreedingEngine.calculateExpectedDryoffDate(insemination, TargetSpecies.CATTLE);
    
    // 2026-10-10 - 60 days = 2026-08-11
    expect(dryOff.toISOString().split('T')[0]).toBe('2026-08-11');
  });

  it('should calculate expected calving date for sheep/goats (150 days)', () => {
    const insemination = new Date('2026-01-01');
    const expected = BreedingEngine.calculateExpectedCalvingDate(insemination, TargetSpecies.SHEEP);
    
    // 2026-01-01 + 150 days = 2026-05-31
    expect(expected.toISOString().split('T')[0]).toBe('2026-05-31');
  });

  it('should calculate PD check date (35 days for cattle)', () => {
    const insemination = new Date('2026-01-01');
    const pdDate = BreedingEngine.calculatePdCheckDate(insemination, TargetSpecies.CATTLE);
    
    // 2026-01-01 + 35 days = 2026-02-05
    expect(pdDate.toISOString().split('T')[0]).toBe('2026-02-05');
  });
});
