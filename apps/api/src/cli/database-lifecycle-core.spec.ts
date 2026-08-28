import {
  assertCompatibleDumpTool,
  assertManagedMigrationState,
  assertSafeRestoreTarget,
  classifyDatabase,
  isRecentBackup,
  parseDatabaseTarget,
  reconcileSnapshots,
} from './database-lifecycle-core';

describe('Database lifecycle safety rules', () => {
  const target = parseDatabaseTarget('postgresql://operator:secret@db.internal:5432/saraya_staging?schema=public');
  const source = { host: 'db.internal', port: 5432, database: 'saraya_production', user: 'operator', serverMajor: 16 };

  it('parses a PostgreSQL target without retaining query-string ambiguity', () => {
    expect(target).toEqual(expect.objectContaining({
      host: 'db.internal', port: 5432, database: 'saraya_staging', user: 'operator', password: 'secret',
    }));
    expect(() => parseDatabaseTarget('mysql://localhost/saraya')).toThrow('Only PostgreSQL');
  });

  it('classifies empty, unmanaged prototype, and migration-managed databases', () => {
    expect(classifyDatabase(0, false)).toBe('EMPTY');
    expect(classifyDatabase(10, false)).toBe('PROTOTYPE_UNMANAGED');
    expect(classifyDatabase(10, true)).toBe('MIGRATION_MANAGED');
  });

  it('blocks migration deploy against an unmanaged prototype', () => {
    expect(() => assertManagedMigrationState('PROTOTYPE_UNMANAGED', [], [])).toThrow('migrate deploy is blocked');
    expect(() => assertManagedMigrationState('MIGRATION_MANAGED', ['foreign_migration'], [])).toThrow('absent from this release');
  });

  it('permits restore only to an explicitly confirmed staging-like database distinct from the source', () => {
    expect(() => assertSafeRestoreTarget(target, source, 'staging', 'saraya_staging')).not.toThrow();
    expect(() => assertSafeRestoreTarget(target, source, 'staging', 'wrong')).toThrow('confirm the exact target');
    expect(() => assertSafeRestoreTarget(
      parseDatabaseTarget('postgresql://operator:secret@db.internal/saraya_production'),
      source,
      'staging',
      'saraya_production',
    )).toThrow('source database');
  });

  it('rejects pg_dump older than the PostgreSQL server', () => {
    expect(() => assertCompatibleDumpTool(15, 16)).toThrow('older');
    expect(() => assertCompatibleDumpTool(16, 16)).not.toThrow();
  });

  it('detects reconciliation changes to rows and financial metrics', () => {
    const before = {
      formatVersion: 1 as const,
      capturedAt: '2026-08-28T00:00:00.000Z',
      target: { host: 'db', port: 5432, database: 'stage', user: 'u' },
      state: 'MIGRATION_MANAGED' as const,
      appliedMigrations: ['0001'],
      rowCounts: { animals: 10 },
      metrics: { journalDebit: '100.000' },
    };
    expect(reconcileSnapshots(before, { ...before, rowCounts: { animals: 11 } }).matches).toBe(false);
    expect(reconcileSnapshots(before, { ...before, rowCounts: { animals: 10, user_sessions: 0 } })).toEqual(
      expect.objectContaining({ matches: true, addedTables: ['user_sessions'] }),
    );
  });

  it('accepts only backups inside the configured freshness window', () => {
    const now = Date.parse('2026-08-28T12:00:00Z');
    expect(isRecentBackup('2026-08-28T11:00:00Z', now)).toBe(true);
    expect(isRecentBackup('2026-08-26T11:00:00Z', now)).toBe(false);
  });
});
