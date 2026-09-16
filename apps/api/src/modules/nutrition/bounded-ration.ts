import { BadRequestException } from '@nestjs/common';
import type { RationIngredientInput } from './ration.service';

// Minimize cost with sum(x)=1, protein(x)>=target and ingredient bounds.
// For a protein shadow price, bounded allocation is a sorted greedy fill.
// Every change in that ordering occurs at a pairwise cost/protein breakpoint.
export function boundedRation(ingredients: RationIngredientInput[], target: number): number[] {
  const epsilon = 1e-9;
  if (ingredients.length < 2 || ingredients.length > 100 || !Number.isFinite(target) || target <= 0 || target > 100) {
    throw new BadRequestException('يلزم 2 إلى 100 مكون وهدف بروتين صالح');
  }
  const bounds = ingredients.map(ingredient => {
    const min = (ingredient.minInclusionPct ?? 0) / 100;
    const max = (ingredient.maxInclusionPct ?? 100) / 100;
    if (![min, max, ingredient.costPerKg, ingredient.proteinPct].every(Number.isFinite) || min < 0 || max > 1 || min > max || ingredient.costPerKg < 0 || ingredient.proteinPct < 0 || ingredient.proteinPct > 100) {
      throw new BadRequestException('أسعار المكونات ونسب البروتين وحدود الإدراج غير صالحة');
    }
    return { min, max };
  });
  if (bounds.reduce((s, b) => s + b.min, 0) > 1 + epsilon || bounds.reduce((s, b) => s + b.max, 0) < 1 - epsilon) {
    throw new BadRequestException('حدود المكونات لا تسمح بخلطة مجموعها 100%');
  }
  const protein = (ratios: number[]) => ratios.reduce((sum, r, i) => sum + r * ingredients[i].proteinPct, 0);
  const fill = (lambda: number, highProtein: boolean) => {
    const ratios = bounds.map(b => b.min);
    let remaining = 1 - ratios.reduce((a, b) => a + b, 0);
    const order = ingredients.map((_, i) => i).sort((a, b) => {
      const diff = (ingredients[a].costPerKg - lambda * ingredients[a].proteinPct) - (ingredients[b].costPerKg - lambda * ingredients[b].proteinPct);
      return Math.abs(diff) > epsilon ? diff : (highProtein ? -1 : 1) * (ingredients[a].proteinPct - ingredients[b].proteinPct) || a - b;
    });
    for (const i of order) {
      const amount = Math.min(Math.max(0, remaining), bounds[i].max - bounds[i].min);
      ratios[i] += amount;
      remaining -= amount;
    }
    return ratios;
  };
  const cheapest = fill(0, true);
  if (protein(cheapest) >= target - epsilon) return cheapest;
  const breakpoints = new Set<number>();
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const denominator = ingredients[i].proteinPct - ingredients[j].proteinPct;
      if (Math.abs(denominator) <= epsilon) continue;
      const lambda = (ingredients[i].costPerKg - ingredients[j].costPerKg) / denominator;
      if (lambda > 0 && Number.isFinite(lambda)) breakpoints.add(lambda);
    }
  }
  for (const lambda of [...breakpoints].sort((a, b) => a - b)) {
    const low = fill(lambda, false);
    const high = fill(lambda, true);
    const lowP = protein(low), highP = protein(high);
    if (lowP <= target + epsilon && highP >= target - epsilon) {
      if (highP - lowP <= epsilon) return high;
      const mix = Math.max(0, Math.min(1, (target - lowP) / (highP - lowP)));
      return low.map((r, i) => r + mix * (high[i] - r));
    }
  }
  throw new BadRequestException('لا يمكن تحقيق هدف البروتين ضمن حدود المكونات؛ عدّل الهدف أو المكونات قبل اعتماد الخلطة');
}
