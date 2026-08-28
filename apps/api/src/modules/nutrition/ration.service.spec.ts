import { RationService, RationIngredientInput, FormulationTarget } from './ration.service';
import { PrismaService } from '../../database/prisma.service';

describe('RationService - Least Cost Formulation', () => {
  let service: RationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {};
    service = new RationService(mockPrisma as PrismaService);
  });

  it('should formulate an optimal TMR ration for dairy cow target 18% protein at least cost', () => {
    const ingredients: RationIngredientInput[] = [
      { id: '1', name: 'ذرة صفراء', costPerKg: 0.32, proteinPct: 8.5, energyMcal: 3.3 },
      { id: '2', name: 'كسب فول صويا', costPerKg: 0.58, proteinPct: 44.0, energyMcal: 3.1 },
    ];

    const target: FormulationTarget = {
      targetProteinPct: 18.0,
      batchTotalKg: 1000, // 1 Ton Batch
    };

    const result = service.calculateLeastCostRation(ingredients, target);

    expect(result).toBeDefined();
    expect(result.batchTotalKg).toBe(1000);
    expect(result.actualProteinPct).toBeCloseTo(18.0, 1);
    expect(result.items.length).toBe(2);
    
    // Total weight must sum to 1000 kg
    const totalKg = result.items.reduce((sum, item) => sum + item.weightKg, 0);
    expect(totalKg).toBeCloseTo(1000, 0);

    // Cost per ton should be calculated accurately
    expect(result.costPerTon).toBeGreaterThan(0);
    expect(result.costPerKg).toBe(result.costPerTon / 1000);
  });
});
