import {
  assertDistinctDatabaseTargets,
  canonicalRow,
  compareNameSets,
  createRowDigest,
  deriveJournalNextNumber,
  normalizePeriodBoundary,
  resolveFormulaOwnership,
} from './prototype-adoption-core';

describe('prototype adoption core', () => {
  it('resolves formula ownership from matching ingredient and distribution evidence', () => {
    const result = resolveFormulaOwnership([
      { formulaId: 'formula-a', ingredientFarmIds: ['farm-a'], distributionFarmIds: ['farm-a'] },
    ], ['farm-a', 'farm-b']);
    expect(result.issues).toEqual([]);
    expect(result.ownership.get('formula-a')).toBe('farm-a');
  });

  it('uses the sole farm only when a formula has no ownership evidence', () => {
    const result = resolveFormulaOwnership([
      { formulaId: 'formula-a', ingredientFarmIds: [], distributionFarmIds: [] },
    ], ['farm-a']);
    expect(result.issues).toEqual([]);
    expect(result.ownership.get('formula-a')).toBe('farm-a');
  });

  it('rejects conflicting and unresolved formula ownership', () => {
    const result = resolveFormulaOwnership([
      { formulaId: 'conflict', ingredientFarmIds: ['farm-a'], distributionFarmIds: ['farm-b'] },
      { formulaId: 'unknown', ingredientFarmIds: [], distributionFarmIds: [] },
    ], ['farm-a', 'farm-b']);
    expect(result.issues).toEqual([
      { code: 'FORMULA_FARM_CONFLICT', entityId: 'conflict' },
      { code: 'FORMULA_FARM_UNRESOLVED', entityId: 'unknown' },
    ]);
  });

  it('derives the next journal sequence from valid numbers only', () => {
    expect(deriveJournalNextNumber({
      farmId: 'farm-a', fiscalYearId: 'year-a', yearName: '2027',
      entryNumbers: ['JV-2027-000001', 'JV-2027-42', 'JV-2027-bad', 'JV-2026-999999'],
    })).toBe(43);
  });

  it('detects same source and target but permits distinct database names', () => {
    const base = { protocol: 'postgresql:' as const, host: 'localhost', port: 5432, database: 'source', user: 'u', password: 'p' };
    expect(() => assertDistinctDatabaseTargets(base, base)).toThrow('different databases');
    expect(() => assertDistinctDatabaseTargets(base, { ...base, database: 'target' })).not.toThrow();
  });

  it('reports missing and unexpected schema names deterministically', () => {
    expect(compareNameSets(['b', 'extra'], ['a', 'b'])).toEqual({ missing: ['a'], unexpected: ['extra'] });
  });

  it('normalizes only a bounded one-day fiscal-period drift', () => {
    const normalized = normalizePeriodBoundary(
      new Date('2025-12-31T00:00:00.000Z'), new Date('2026-01-31T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'), new Date('2026-12-31T00:00:00.000Z'),
    );
    expect(normalized).toEqual({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      changed: true,
    });
    expect(normalizePeriodBoundary(
      new Date('2025-12-29T00:00:00.000Z'), new Date('2026-01-31T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'), new Date('2026-12-31T00:00:00.000Z'),
    )).toBeUndefined();
  });

  it('creates stable row digests with canonical object key ordering', () => {
    expect(canonicalRow([new Date('2026-01-02T03:04:05.000Z'), { b: 2, a: 1 }]))
      .toBe('["2026-01-02T03:04:05.000Z",{"a":1,"b":2}]\n');
    const first = createRowDigest();
    const second = createRowDigest();
    first.update(['id-1', { b: 2, a: 1 }]);
    second.update(['id-1', { a: 1, b: 2 }]);
    expect(first.finish()).toEqual(second.finish());
  });
});
