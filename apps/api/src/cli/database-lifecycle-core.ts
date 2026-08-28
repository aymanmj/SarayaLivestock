export type DatabaseEnvironment = 'development' | 'staging' | 'production';
export type DatabaseState = 'EMPTY' | 'PROTOTYPE_UNMANAGED' | 'MIGRATION_MANAGED';

export interface DatabaseTarget {
  protocol: 'postgresql:' | 'postgres:';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode?: string;
}

export interface DatabaseSnapshot {
  formatVersion: 1;
  capturedAt: string;
  target: Omit<DatabaseTarget, 'password' | 'protocol'>;
  state: DatabaseState;
  appliedMigrations: string[];
  rowCounts: Record<string, number>;
  metrics: Record<string, string>;
}

export interface BackupManifest {
  formatVersion: 1;
  createdAt: string;
  backupFile: string;
  sha256: string;
  sizeBytes: number;
  source: Omit<DatabaseTarget, 'password' | 'protocol'> & { serverMajor: number };
  state: DatabaseState;
  appliedMigrations: string[];
  snapshotFile: string;
  writesStopped: boolean;
}

export function parseDatabaseTarget(raw: string): DatabaseTarget {
  if (!raw?.trim()) throw new Error('DATABASE_URL is required');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('Only PostgreSQL database URLs are supported');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database || database.includes('/')) throw new Error('DATABASE_URL must identify exactly one database');
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PostgreSQL port');
  return {
    protocol: url.protocol,
    host: url.hostname,
    port,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sslMode: url.searchParams.get('sslmode') || undefined,
  };
}

export function publicTarget(target: DatabaseTarget): Omit<DatabaseTarget, 'password' | 'protocol'> {
  return {
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    sslMode: target.sslMode,
  };
}

export function classifyDatabase(userTableCount: number, hasMigrationTable: boolean): DatabaseState {
  if (userTableCount === 0) return 'EMPTY';
  return hasMigrationTable ? 'MIGRATION_MANAGED' : 'PROTOTYPE_UNMANAGED';
}

export function parseDatabaseEnvironment(value?: string): DatabaseEnvironment {
  if (value === 'development' || value === 'staging' || value === 'production') return value;
  throw new Error('SARAYA_DB_ENV must be exactly development, staging, or production');
}

export function assertConfirmedTarget(target: DatabaseTarget, environment: DatabaseEnvironment, confirmation?: string) {
  if (confirmation !== target.database) {
    throw new Error(`Set SARAYA_DB_CONFIRM=${target.database} to confirm the exact target database`);
  }
  if (environment === 'production' && process.env.SARAYA_DB_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Production changes require SARAYA_DB_ALLOW_PRODUCTION=true');
  }
  if (environment === 'production' && !process.env.SARAYA_DB_CHANGE_TICKET?.trim()) {
    throw new Error('Production changes require SARAYA_DB_CHANGE_TICKET');
  }
}

export function assertSafeRestoreTarget(
  target: DatabaseTarget,
  source: BackupManifest['source'],
  environment: DatabaseEnvironment,
  confirmation?: string,
) {
  if (environment !== 'staging') throw new Error('Restore rehearsal is allowed only with SARAYA_DB_ENV=staging');
  assertConfirmedTarget(target, environment, confirmation);
  if (target.host === source.host && target.port === source.port && target.database === source.database) {
    throw new Error('Restoring a backup over its source database is forbidden');
  }
  if (!/(staging|stage|restore|rehearsal|test)/i.test(target.database)) {
    throw new Error('Restore target database name must clearly contain staging, restore, rehearsal, or test');
  }
}

export function assertManagedMigrationState(
  state: DatabaseState,
  unknownMigrations: string[],
  failedMigrations: string[],
) {
  if (state === 'PROTOTYPE_UNMANAGED') {
    throw new Error('Prototype database has no Prisma history; migrate deploy is blocked. Restore/export it into staging first.');
  }
  if (unknownMigrations.length) {
    throw new Error(`Database contains migrations absent from this release: ${unknownMigrations.join(', ')}`);
  }
  if (failedMigrations.length) {
    throw new Error(`Database contains failed migrations: ${failedMigrations.join(', ')}`);
  }
}

export function parsePostgresMajor(versionOutput: string): number {
  const match = versionOutput.match(/(\d+)(?:\.\d+)?/);
  if (!match) throw new Error(`Unable to parse PostgreSQL tool version: ${versionOutput.trim()}`);
  return Number(match[1]);
}

export function assertCompatibleDumpTool(toolMajor: number, serverMajor: number) {
  if (toolMajor < serverMajor) {
    throw new Error(`pg_dump ${toolMajor} is older than PostgreSQL server ${serverMajor}; install pg_dump ${serverMajor} or newer`);
  }
}

export function reconcileSnapshots(before: DatabaseSnapshot, after: DatabaseSnapshot) {
  const differences: string[] = [];
  for (const [table, count] of Object.entries(before.rowCounts)) {
    if (!(table in after.rowCounts)) differences.push(`table removed: ${table}`);
    else if (after.rowCounts[table] !== count) differences.push(`row count changed: ${table} ${count} -> ${after.rowCounts[table]}`);
  }
  for (const [metric, value] of Object.entries(before.metrics)) {
    if (!(metric in after.metrics)) differences.push(`metric removed: ${metric}`);
    else if (after.metrics[metric] !== value) differences.push(`metric changed: ${metric} ${value} -> ${after.metrics[metric]}`);
  }
  return {
    matches: differences.length === 0,
    differences,
    addedTables: Object.keys(after.rowCounts).filter(table => !(table in before.rowCounts)),
  };
}

export function isRecentBackup(createdAt: string, now = Date.now(), maxAgeHours = 24) {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeHours * 60 * 60 * 1000;
}
