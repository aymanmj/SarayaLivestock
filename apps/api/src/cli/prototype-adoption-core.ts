import { createHash } from 'crypto';
import { DatabaseTarget } from './database-lifecycle-core';

export interface FormulaOwnershipEvidence {
  formulaId: string;
  ingredientFarmIds: string[];
  distributionFarmIds: string[];
}

export interface FormulaOwnershipResolution {
  ownership: Map<string, string>;
  issues: Array<{ code: 'FORMULA_FARM_CONFLICT' | 'FORMULA_FARM_UNRESOLVED'; entityId: string }>;
}

export interface JournalNumberEvidence {
  farmId: string;
  fiscalYearId: string;
  yearName: string;
  entryNumbers: string[];
}

export function resolveFormulaOwnership(
  formulas: FormulaOwnershipEvidence[],
  allFarmIds: string[],
): FormulaOwnershipResolution {
  const ownership = new Map<string, string>();
  const issues: FormulaOwnershipResolution['issues'] = [];
  const soleFarmId = new Set(allFarmIds).size === 1 ? allFarmIds[0] : undefined;

  for (const formula of formulas) {
    const candidates = new Set([...formula.ingredientFarmIds, ...formula.distributionFarmIds]);
    if (candidates.size === 1) ownership.set(formula.formulaId, [...candidates][0]);
    else if (candidates.size === 0 && soleFarmId) ownership.set(formula.formulaId, soleFarmId);
    else {
      issues.push({
        code: candidates.size > 1 ? 'FORMULA_FARM_CONFLICT' : 'FORMULA_FARM_UNRESOLVED',
        entityId: formula.formulaId,
      });
    }
  }
  return { ownership, issues };
}

export function deriveJournalNextNumber(evidence: JournalNumberEvidence) {
  const prefix = `JV-${evidence.yearName}-`;
  let maximum = 0;
  for (const entryNumber of evidence.entryNumbers) {
    if (!entryNumber.startsWith(prefix)) continue;
    const suffix = entryNumber.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const parsed = Number(suffix);
    if (Number.isSafeInteger(parsed)) maximum = Math.max(maximum, parsed);
  }
  return maximum + 1;
}

export function assertDistinctDatabaseTargets(source: DatabaseTarget, target: DatabaseTarget) {
  if (source.host === target.host && source.port === target.port && source.database === target.database) {
    throw new Error('Prototype source and adoption target must be different databases');
  }
}

export function compareNameSets(actual: string[], expected: string[]) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter(name => !actualSet.has(name)).sort(),
    unexpected: actual.filter(name => !expectedSet.has(name)).sort(),
  };
}

export function normalizePeriodBoundary(
  periodStart: Date,
  periodEnd: Date,
  yearStart: Date,
  yearEnd: Date,
  maxDriftDays = 1,
) {
  const start = Math.max(periodStart.getTime(), yearStart.getTime());
  const end = Math.min(periodEnd.getTime(), yearEnd.getTime());
  if (start > end) return undefined;
  const drift = Math.max(
    Math.abs(start - periodStart.getTime()),
    Math.abs(end - periodEnd.getTime()),
  );
  if (drift > maxDriftDays * 24 * 60 * 60 * 1000) return undefined;
  return { startDate: new Date(start), endDate: new Date(end), changed: drift > 0 };
}

export function canonicalRow(values: unknown[]) {
  return `${JSON.stringify(values.map(canonicalValue))}\n`;
}

export function createRowDigest() {
  const hash = createHash('sha256');
  let rows = 0;
  return {
    update(values: unknown[]) {
      hash.update(canonicalRow(values));
      rows += 1;
    },
    finish() {
      return { rows, sha256: hash.digest('hex') };
    },
  };
}

function canonicalValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  return value;
}
