import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { boundedRation } from './bounded-ration';
import type { RationIngredientInput } from './ration.service';

const SCALE = 10_000;
const MAX_NODES = 5_000;
const MAX_TIME_MS = 1_000;

/** Integer branch-and-bound at 0.01 percentage point storage precision.
 * Only return after all potentially cheaper branches are excluded.
 * Resource exhaustion is an explicit failure, never an "optimal" heuristic.
 */
export function optimizeStoredRation(ingredients: RationIngredientInput[], target: number): number[] {
  boundedRation(ingredients, target);
  const prices = ingredients.map(i => Math.round(i.costPerKg * 1000));
  const proteins = ingredients.map(i => Math.round(i.proteinPct * 100));
  if (ingredients.some((i, n) => Math.abs(prices[n] / 1000 - i.costPerKg) > 1e-9
    || Math.abs(proteins[n] / 100 - i.proteinPct) > 1e-9 || prices[n] > 1_000_000_000)
    || Math.abs(Math.round(target * 100) / 100 - target) > 1e-9) {
    throw new BadRequestException('يلزم بروتين بدقة منزلتين وأسعار بدقة ثلاث منازل ضمن الحدود المسموحة');
  }
  const requiredProtein = Math.round(target * 100) * SCALE;
  type Bounds = { lower: number[]; upper: number[] };
  const pending: Bounds[] = [{
    lower: ingredients.map(i => Math.ceil((i.minInclusionPct ?? 0) * 100 - 1e-8)),
    upper: ingredients.map(i => Math.floor((i.maxInclusionPct ?? 100) * 100 + 1e-8)),
  }];
  let best: number[] | undefined;
  let bestCost = Infinity;
  let nodes = 0;
  const started = Date.now();
  while (pending.length) {
    if (++nodes > MAX_NODES || Date.now() - started > MAX_TIME_MS) {
      throw new UnprocessableEntityException('لم يكتمل إثبات أقل تكلفة ضمن حد الحساب؛ قلّل عدد المكونات أو ضيّق حدودها وأعد المحاولة');
    }
    const bounds = pending.pop()!;
    if (bounds.lower.some((v, i) => v > bounds.upper[i])
      || bounds.lower.reduce((a, b) => a + b, 0) > SCALE
      || bounds.upper.reduce((a, b) => a + b, 0) < SCALE) continue;
    let units: number[];
    try {
      units = boundedRation(ingredients.map((i, n) => ({
        ...i, minInclusionPct: bounds.lower[n] / 100, maxInclusionPct: bounds.upper[n] / 100,
      })), target).map(r => r * SCALE);
    } catch (error) {
      if (error instanceof BadRequestException) continue;
      throw error;
    }
    const relaxedCost = units.reduce((sum, u, i) => sum + u * prices[i], 0);
    // Prices and final units are integral; conservatively allow LP numeric noise.
    if (Math.ceil(relaxedCost - 1e-4) >= bestCost) continue;
    const fractional = units.findIndex(u => Math.abs(u - Math.round(u)) > 1e-7);
    if (fractional < 0) {
      const candidate = units.map(Math.round);
      if (candidate.reduce((a, b) => a + b, 0) !== SCALE
        || candidate.some((u, i) => u < bounds.lower[i] || u > bounds.upper[i])
        || candidate.reduce((s, u, i) => s + u * proteins[i], 0) < requiredProtein) {
        throw new UnprocessableEntityException('تعذر التحقق العددي من الخلطة؛ عدّل الحدود وأعد الحساب');
      }
      const cost = candidate.reduce((s, u, i) => s + u * prices[i], 0);
      if (cost < bestCost) { bestCost = cost; best = candidate; }
      continue;
    }
    const below = { lower: [...bounds.lower], upper: [...bounds.upper] };
    const above = { lower: [...bounds.lower], upper: [...bounds.upper] };
    below.upper[fractional] = Math.floor(units[fractional]);
    above.lower[fractional] = Math.ceil(units[fractional]);
    pending.push(below, above);
  }
  if (!best) throw new BadRequestException('لا توجد خلطة تحقق البروتين والحدود بدقة الحفظ');
  return best.map(u => u / SCALE);
}
