import { RationService, RationIngredientInput, FormulationTarget } from './ration.service';
import { PrismaService } from '../../database/prisma.service';

describe('RationService - Least Cost Formulation', () => {
  let service: RationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {};
    service = new RationService(mockPrisma as PrismaService);
  });
  it.each([
    { protein: [15, 16, 99], cost: [1, 2, 84], target: 15.01, ceiling: 1009.9 },
    { protein: [7, 36, 81], cost: [1, 5, 42], target: 41.09, ceiling: 9188 },
    { protein: [89, 78, 42], cost: [96, 82, 48], target: 65.51, ceiling: 70204.8 },
  ])('optimizes at stored precision: $target', ({ protein, cost, target, ceiling }) => {
    const ingredients = protein.map((proteinPct, i) => ({ id: String(i), name: String(i), proteinPct, costPerKg: cost[i], energyMcal: 0 }));
    const result = service.calculateLeastCostRation(ingredients, { targetProteinPct: target, batchTotalKg: 1000 });
    expect(result.totalCost).toBeLessThanOrEqual(ceiling + 1e-7);
    expect(result.items.reduce((sum, item) => sum + Math.round(item.percentage * 100), 0)).toBe(10000);
    expect(result.items.reduce((sum, item) => sum + item.percentage * protein[Number(item.ingredientId)] / 100, 0)).toBeGreaterThanOrEqual(target - 1e-9);
  });

  it('matches exhaustive integer search across independent bounded mixtures', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const protein = [10, 20 + seed % 7, 40 + seed % 11];
      const costs = [1 + seed % 3, 2 + seed % 5, 3 + seed % 7];
      const target = 23 + seed / 100;
      const ingredients = protein.map((proteinPct, i) => ({
        id: String(i), name: String(i), proteinPct, costPerKg: costs[i], energyMcal: 0,
        minInclusionPct: 33, maxInclusionPct: 34,
      }));
      let optimum = Infinity;
      for (let a = 3300; a <= 3400; a++) for (let b = 3300; b <= 3400; b++) {
        const c = 10000 - a - b;
        if (c < 3300 || c > 3400 || (a * protein[0] + b * protein[1] + c * protein[2]) / 10000 < target) continue;
        optimum = Math.min(optimum, (a * costs[0] + b * costs[1] + c * costs[2]) / 10);
      }
      if (!Number.isFinite(optimum)) {
        expect(() => service.calculateLeastCostRation(ingredients, { targetProteinPct: target, batchTotalKg: 1000 })).toThrow();
      } else {
        expect(service.calculateLeastCostRation(ingredients, { targetProteinPct: target, batchTotalKg: 1000 }).totalCost).toBeCloseTo(optimum, 5);
      }
    }
  });
  it('finds a feasible minimum when another ingredient is at its upper bound', () => {
    const result = service.calculateLeastCostRation([
      { id: 'A', name: 'A', costPerKg: 1, proteinPct: 5, energyMcal: 0, maxInclusionPct: 40 },
      { id: 'B', name: 'B', costPerKg: 1, proteinPct: 10, energyMcal: 0, maxInclusionPct: 40 },
      { id: 'C', name: 'C', costPerKg: 10, proteinPct: 40, energyMcal: 0 },
    ], { targetProteinPct: 20, batchTotalKg: 1000 });
    expect(result.actualProteinPct).toBeGreaterThanOrEqual(20);
    // B=40%, C=13/35, A=8/35: cost = 1000 * (1 + 9 * 13/35).
    // Stored hundredths must meet the minimum too (C=37.15%).
    expect(result.totalCost).toBe(4343.5);
  });
  it('rejects an impossible target instead of returning an approvable deficient ration', () => {
    expect(() => service.calculateLeastCostRation([
      { id: 'A', name: 'A', costPerKg: 1, proteinPct: 10, energyMcal: 0 },
      { id: 'B', name: 'B', costPerKg: 2, proteinPct: 12, energyMcal: 0 },
    ], { targetProteinPct: 18, batchTotalKg: 1000 })).toThrow();
  });
  it('returns exactly 100 percent at storage precision while preserving the protein minimum', () => {
    const ingredients = [
      { id: 'A', name: 'A', costPerKg: 1, proteinPct: 0, energyMcal: 0, minInclusionPct: 33.33, maxInclusionPct: 33.33 },
      { id: 'B', name: 'B', costPerKg: 1, proteinPct: 0, energyMcal: 0 },
      { id: 'C', name: 'C', costPerKg: 10, proteinPct: 40, energyMcal: 0 },
    ];
    const result = service.calculateLeastCostRation(ingredients, { targetProteinPct: 20.01, batchTotalKg: 1000 });
    expect(result.items.reduce((sum, item) => sum + Math.round(item.percentage * 100), 0)).toBe(10000);
    expect(result.items[0].percentage).toBe(33.33);
    expect(result.items.reduce((sum, item) => sum + item.percentage * ingredients.find(i => i.id === item.ingredientId)!.proteinPct / 100, 0)).toBeGreaterThanOrEqual(20.01);
    for (const item of result.items) expect(item.weightKg).toBeCloseTo(item.percentage * 10, 6);
  });
  it('allows saving the calculated optimal ration to createFormula without percentage sum rejection', async () => {
    const ingredients = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'A', costPerKg: 1, proteinPct: 0, energyMcal: 0, minInclusionPct: 33.33, maxInclusionPct: 33.33 },
      { id: '22222222-2222-4222-8222-222222222222', name: 'B', costPerKg: 1, proteinPct: 0, energyMcal: 0 },
      { id: '33333333-3333-4333-8333-333333333333', name: 'C', costPerKg: 10, proteinPct: 40, energyMcal: 0 },
    ];
    const result = service.calculateLeastCostRation(ingredients, { targetProteinPct: 20.01, batchTotalKg: 1000 });
    
    mockPrisma.feedIngredient = { count: jest.fn().mockResolvedValue(result.items.length) };
    mockPrisma.feedFormula = { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'formula-id', ...data })) };
    mockPrisma.$transaction = jest.fn().mockImplementation(async (callback: any) => callback(mockPrisma));

    const saved = await service.createFormula({
      name: 'Tested Formula',
      items: result.items.map(i => ({ ingredientId: i.ingredientId, percentage: i.percentage })),
    }, 'test-farm');

    expect(saved).toBeDefined();
    expect(mockPrisma.feedFormula.create).toHaveBeenCalled();
  });
  it('can use a cheaper ration above the minimum protein target', () => {
    const result = service.calculateLeastCostRation([
      { id: 'A', name: 'A', costPerKg: 1, proteinPct: 20, energyMcal: 0 },
      { id: 'B', name: 'B', costPerKg: 2, proteinPct: 10, energyMcal: 0 },
    ], { targetProteinPct: 18, batchTotalKg: 1000 });
    expect(result.totalCost).toBe(1000);
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
