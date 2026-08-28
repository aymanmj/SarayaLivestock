import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { access, mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'path';
import { Pool, PoolClient } from 'pg';
import {
  assertCompatibleDumpTool,
  assertConfirmedTarget,
  assertManagedMigrationState,
  assertSafeRestoreTarget,
  BackupManifest,
  classifyDatabase,
  DatabaseSnapshot,
  DatabaseState,
  DatabaseTarget,
  isRecentBackup,
  parseDatabaseEnvironment,
  parseDatabaseTarget,
  parsePostgresMajor,
  publicTarget,
  reconcileSnapshots,
} from './database-lifecycle-core';

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

interface Inspection {
  target: ReturnType<typeof publicTarget>;
  state: DatabaseState;
  serverMajor: number;
  userTables: string[];
  hasMigrationTable: boolean;
  expectedMigrations: string[];
  appliedMigrations: string[];
  pendingMigrations: string[];
  unknownMigrations: string[];
  failedMigrations: string[];
  dataIssues: Record<string, number>;
}

const apiRoot = resolve(process.cwd());
const repositoryRoot = resolve(apiRoot, '../..');
const defaultBackupDir = resolve(repositoryRoot, 'backups');

async function main() {
  const command = process.argv[2];
  const { flags, positional } = parseArguments(process.argv.slice(3));
  switch (command) {
    case 'inspect':
      return printJson(await inspectDatabase(requiredUrl('DATABASE_URL')));
    case 'snapshot':
      return snapshotCommand(requiredUrl('DATABASE_URL'), flags.output);
    case 'backup':
      return backupCommand(requiredUrl('DATABASE_URL'), flags.outputDir);
    case 'verify-backup':
      return verifyBackupCommand(flags.manifest || requiredPosition(positional, 0, 'manifest path'));
    case 'restore':
      return restoreCommand(restoreUrl(), flags.manifest || requiredPosition(positional, 0, 'manifest path'));
    case 'migrate-safe':
      return migrateSafeCommand(migrationUrl(), flags.manifest || positional[0]);
    case 'reconcile':
      return reconcileCommand(
        flags.before || requiredPosition(positional, 0, 'before snapshot'),
        flags.after || requiredPosition(positional, 1, 'after snapshot'),
      );
    default:
      throw new Error(
        'Usage: database-lifecycle <inspect|snapshot|backup|verify-backup|restore|migrate-safe|reconcile> [--flag value]',
      );
  }
}

async function inspectDatabase(connectionString: string): Promise<Inspection> {
  const target = parseDatabaseTarget(connectionString);
  const pool = createPool(connectionString);
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const versionResult = await client.query<{ server_version_num: string }>('SHOW server_version_num');
      const serverMajor = Math.floor(Number(versionResult.rows[0].server_version_num) / 10_000);
      const tableResult = await client.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const allTables = tableResult.rows.map(row => row.table_name);
      const hasMigrationTable = allTables.includes('_prisma_migrations');
      const userTables = allTables.filter(name => name !== '_prisma_migrations');
      const expectedMigrations = await migrationDirectories();
      let migrationRows: MigrationRow[] = [];
      if (hasMigrationTable) {
        migrationRows = (await client.query<MigrationRow>(`
          SELECT migration_name, finished_at, rolled_back_at
          FROM "_prisma_migrations"
          ORDER BY started_at
        `)).rows;
      }
      const appliedMigrations = migrationRows
        .filter(row => row.finished_at && !row.rolled_back_at)
        .map(row => row.migration_name);
      const failedMigrations = migrationRows
        .filter(row => !row.finished_at && !row.rolled_back_at)
        .map(row => row.migration_name);
      const state = classifyDatabase(userTables.length, hasMigrationTable);
      const dataIssues = await inspectDataIssues(client, new Set(userTables));
      await client.query('COMMIT');
      return {
        target: publicTarget(target),
        state,
        serverMajor,
        userTables,
        hasMigrationTable,
        expectedMigrations,
        appliedMigrations,
        pendingMigrations: expectedMigrations.filter(name => !appliedMigrations.includes(name)),
        unknownMigrations: appliedMigrations.filter(name => !expectedMigrations.includes(name)),
        failedMigrations,
        dataIssues,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function inspectDataIssues(client: PoolClient, tables: Set<string>) {
  const checks: Array<{ name: string; tables: string[]; sql: string }> = [
    {
      name: 'duplicateBarnNames', tables: ['barns'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "farmId", name FROM barns GROUP BY "farmId", name HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'duplicateAnimalTags', tables: ['animals'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "farmId", "tagNumber" FROM animals GROUP BY "farmId", "tagNumber" HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'duplicateFeedIngredientNames', tables: ['feed_ingredients'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "farmId", name FROM feed_ingredients GROUP BY "farmId", name HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'duplicateFeedFormulaNames', tables: ['feed_formulas'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "farmId", name FROM feed_formulas GROUP BY "farmId", name HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'duplicateMilkShifts', tables: ['milk_logs'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "animalId", "logDate", shift FROM milk_logs GROUP BY "animalId", "logDate", shift HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'duplicateDailyWeights', tables: ['weight_logs'],
      sql: `SELECT COUNT(*)::int AS count FROM (SELECT "animalId", "weighDate" FROM weight_logs GROUP BY "animalId", "weighDate" HAVING COUNT(*) > 1) q`,
    },
    {
      name: 'unbalancedJournalHeaders', tables: ['journal_entries'],
      sql: `SELECT COUNT(*)::int AS count FROM journal_entries WHERE "totalDebit" <> "totalCredit"`,
    },
    {
      name: 'orphanJournalLines', tables: ['journal_entry_lines', 'journal_entries'],
      sql: `SELECT COUNT(*)::int AS count FROM journal_entry_lines l LEFT JOIN journal_entries j ON j.id = l."journalEntryId" WHERE j.id IS NULL`,
    },
    {
      name: 'mismatchedJournalLineTotals', tables: ['journal_entry_lines', 'journal_entries'],
      sql: `SELECT COUNT(*)::int AS count FROM journal_entries j LEFT JOIN (SELECT "journalEntryId", COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit FROM journal_entry_lines GROUP BY "journalEntryId") l ON l."journalEntryId" = j.id WHERE j."totalDebit" <> COALESCE(l.debit, 0) OR j."totalCredit" <> COALESCE(l.credit, 0)`,
    },
    {
      name: 'crossFarmFormulaIngredients', tables: ['feed_formula_items', 'feed_formulas', 'feed_ingredients'],
      sql: `SELECT COUNT(*)::int AS count FROM feed_formula_items i JOIN feed_formulas f ON f.id = i."formulaId" JOIN feed_ingredients g ON g.id = i."ingredientId" WHERE f."farmId" <> g."farmId"`,
    },
  ];
  const issues: Record<string, number> = {};
  for (const check of checks) {
    if (!check.tables.every(table => tables.has(table))) continue;
    await client.query('SAVEPOINT lifecycle_preflight_check');
    try {
      issues[check.name] = Number((await client.query<{ count: number }>(check.sql)).rows[0].count);
      await client.query('RELEASE SAVEPOINT lifecycle_preflight_check');
    } catch (error: any) {
      await client.query('ROLLBACK TO SAVEPOINT lifecycle_preflight_check');
      await client.query('RELEASE SAVEPOINT lifecycle_preflight_check');
      // Prototype schemas can have the table but predate a required ownership column.
      if (error?.code === '42703') issues[check.name] = -1;
      else throw error;
    }
  }
  return issues;
}

async function captureSnapshot(connectionString: string, inspection?: Inspection): Promise<DatabaseSnapshot> {
  const inspected = inspection ?? await inspectDatabase(connectionString);
  const target = parseDatabaseTarget(connectionString);
  const pool = createPool(connectionString);
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const rowCounts: Record<string, number> = {};
      for (const table of inspected.userTables) {
        const quoted = `"${table.replace(/"/g, '""')}"`;
        rowCounts[table] = Number((await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quoted}`)).rows[0].count);
      }
      const metrics: Record<string, string> = {};
      if (inspected.userTables.includes('journal_entries')) {
        const row = (await client.query(`
          SELECT COALESCE(SUM("totalDebit"), 0)::text AS debit,
                 COALESCE(SUM("totalCredit"), 0)::text AS credit
          FROM journal_entries
        `)).rows[0];
        metrics.journalHeaderDebit = row.debit;
        metrics.journalHeaderCredit = row.credit;
      }
      if (inspected.userTables.includes('journal_entry_lines')) {
        const row = (await client.query(`
          SELECT COALESCE(SUM(debit), 0)::text AS debit, COALESCE(SUM(credit), 0)::text AS credit
          FROM journal_entry_lines
        `)).rows[0];
        metrics.journalLineDebit = row.debit;
        metrics.journalLineCredit = row.credit;
      }
      if (inspected.userTables.includes('milk_logs')) {
        metrics.milkYieldLiters = (await client.query<{ total: string }>(
          `SELECT COALESCE(SUM("yieldLiters"), 0)::text AS total FROM milk_logs`,
        )).rows[0].total;
      }
      if (inspected.userTables.includes('feed_ingredients')) {
        metrics.feedCurrentStock = (await client.query<{ total: string }>(
          `SELECT COALESCE(SUM("currentStock"), 0)::text AS total FROM feed_ingredients`,
        )).rows[0].total;
      }
      await client.query('COMMIT');
      return {
        formatVersion: 1,
        capturedAt: new Date().toISOString(),
        target: publicTarget(target),
        state: inspected.state,
        appliedMigrations: inspected.appliedMigrations,
        rowCounts,
        metrics,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function snapshotCommand(connectionString: string, output?: string) {
  const snapshot = await captureSnapshot(connectionString);
  const targetPath = output ? resolve(output) : resolve(defaultBackupDir, `snapshot-${safeTimestamp()}.json`);
  await writeJsonExclusive(targetPath, snapshot);
  console.log(`Database snapshot written: ${targetPath}`);
}

async function backupCommand(connectionString: string, outputDir?: string) {
  const target = parseDatabaseTarget(connectionString);
  const inspection = await inspectDatabase(connectionString);
  const pgDump = await resolvePostgresTool('pg_dump', 'PG_DUMP_PATH', inspection.serverMajor);
  const pgRestore = await resolvePostgresTool('pg_restore', 'PG_RESTORE_PATH', inspection.serverMajor);

  const directory = resolve(outputDir || process.env.DATABASE_BACKUP_DIR || defaultBackupDir);
  await mkdir(directory, { recursive: true });
  const stem = `saraya-${sanitizeFilename(target.database)}-${safeTimestamp()}-${randomBytes(3).toString('hex')}`;
  const backupPath = resolve(directory, `${stem}.dump`);
  const snapshotPath = resolve(directory, `${stem}.snapshot.json`);
  const manifestPath = resolve(directory, `${stem}.manifest.json`);
  try {
    await runTool(pgDump, [
      '--format=custom', '--compress=9', '--no-owner', '--no-privileges', '--file', backupPath,
      ...connectionArgs(target),
    ], targetEnvironment(target));
  } catch (error) {
    await unlink(backupPath).catch(() => undefined);
    throw error;
  }
  await assertNonEmptyFile(backupPath);
  await runTool(pgRestore, ['--list', backupPath]);
  const snapshot = await captureSnapshot(connectionString, inspection);
  await writeJsonExclusive(snapshotPath, snapshot);
  const fileStat = await stat(backupPath);
  const manifest: BackupManifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    backupFile: basename(backupPath),
    sha256: await sha256File(backupPath),
    sizeBytes: fileStat.size,
    source: { ...publicTarget(target), serverMajor: inspection.serverMajor },
    state: inspection.state,
    appliedMigrations: inspection.appliedMigrations,
    snapshotFile: basename(snapshotPath),
    writesStopped: process.env.SARAYA_DB_WRITES_STOPPED === 'true',
  };
  await writeJsonExclusive(manifestPath, manifest);
  console.log(`Verified custom-format backup: ${backupPath}`);
  console.log(`Backup manifest: ${manifestPath}`);
}

async function verifyBackupCommand(manifestFile: string) {
  const { manifest, manifestPath, backupPath } = await loadAndVerifyManifest(manifestFile);
  const pgRestore = await resolvePostgresTool('pg_restore', 'PG_RESTORE_PATH', manifest.source.serverMajor);
  const listing = await runTool(pgRestore, ['--list', backupPath]);
  if (!listing.stdout.trim()) throw new Error('pg_restore returned an empty archive listing');
  console.log(`Backup verified: ${backupPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`SHA-256: ${manifest.sha256}`);
}

async function restoreCommand(connectionString: string, manifestFile: string) {
  const environment = parseDatabaseEnvironment(process.env.SARAYA_DB_ENV);
  const target = parseDatabaseTarget(connectionString);
  const { manifest, backupPath, snapshot: sourceSnapshot } = await loadAndVerifyManifest(manifestFile);
  assertSafeRestoreTarget(target, manifest.source, environment, process.env.SARAYA_DB_CONFIRM);
  const targetInspection = await inspectDatabase(connectionString);
  if (targetInspection.userTables.length > 0 || targetInspection.hasMigrationTable || targetInspection.state !== 'EMPTY') {
    throw new Error('Restore target must be a pre-created empty database; existing tables will never be overwritten');
  }
  const pgRestore = await resolvePostgresTool('pg_restore', 'PG_RESTORE_PATH', manifest.source.serverMajor);
  await runTool(pgRestore, [
    '--exit-on-error', '--no-owner', '--no-privileges', ...connectionArgs(target), backupPath,
  ], targetEnvironment(target));
  const restored = await inspectDatabase(connectionString);
  const restoredSnapshot = await captureSnapshot(connectionString, restored);
  const snapshotPath = resolve(dirname(resolve(manifestFile)), `restore-${sanitizeFilename(target.database)}-${safeTimestamp()}.snapshot.json`);
  await writeJsonExclusive(snapshotPath, restoredSnapshot);
  const reconciliation = reconcileSnapshots(sourceSnapshot, restoredSnapshot);
  if (!reconciliation.matches) {
    throw new Error(`Restored data does not reconcile with the backup snapshot (${snapshotPath}): ${reconciliation.differences.join('; ')}`);
  }
  console.log(`Restore rehearsal completed into empty target: ${target.host}:${target.port}/${target.database}`);
  console.log(`Restored database state: ${restored.state}`);
  console.log(`Post-restore snapshot: ${snapshotPath}`);
  console.log('Source and restored row counts and business totals reconcile exactly.');
  if (restored.state === 'PROTOTYPE_UNMANAGED') {
    console.log('Prototype history detected: migrate-safe remains blocked; use the reviewed export/import adoption path.');
  }
}

async function migrateSafeCommand(connectionString: string, manifestFile?: string) {
  const environment = parseDatabaseEnvironment(process.env.SARAYA_DB_ENV);
  if (environment === 'development') throw new Error('migrate-safe is reserved for staging or production');
  const target = parseDatabaseTarget(connectionString);
  assertConfirmedTarget(target, environment, process.env.SARAYA_DB_CONFIRM);
  if (process.env.SARAYA_DB_WRITES_STOPPED !== 'true') {
    throw new Error('Set SARAYA_DB_WRITES_STOPPED=true only after application writes have been stopped');
  }
  const beforeInspection = await inspectDatabase(connectionString);
  assertManagedMigrationState(beforeInspection.state, beforeInspection.unknownMigrations, beforeInspection.failedMigrations);
  const issueEntries = Object.entries(beforeInspection.dataIssues).filter(([, count]) => count !== 0);
  if (issueEntries.length) {
    throw new Error(`Preflight data issues must be resolved: ${issueEntries.map(([name, count]) => `${name}=${count}`).join(', ')}`);
  }
  let backupSnapshot: DatabaseSnapshot | undefined;
  if (beforeInspection.state !== 'EMPTY') {
    if (!manifestFile) throw new Error('A verified --manifest created within 24 hours is required before migrating a non-empty database');
    const { manifest, snapshot } = await loadAndVerifyManifest(manifestFile);
    assertManifestMatchesTarget(manifest, target);
    if (!isRecentBackup(manifest.createdAt)) throw new Error('Backup manifest is older than 24 hours');
    if (!manifest.writesStopped) {
      throw new Error('Migration backup was not created with SARAYA_DB_WRITES_STOPPED=true');
    }
    backupSnapshot = snapshot;
  }
  const before = await captureSnapshot(connectionString, beforeInspection);
  if (backupSnapshot) {
    const frozenDataCheck = reconcileSnapshots(backupSnapshot, before);
    if (!frozenDataCheck.matches) {
      throw new Error(`Database changed after its backup: ${frozenDataCheck.differences.join('; ')}`);
    }
  }
  const beforePath = resolve(defaultBackupDir, `pre-migration-${sanitizeFilename(target.database)}-${safeTimestamp()}.json`);
  await writeJsonExclusive(beforePath, before);
  const prismaCli = resolve(apiRoot, 'node_modules/prisma/build/index.js');
  await runTool(process.execPath, [prismaCli, 'migrate', 'deploy'], { ...process.env, DATABASE_URL: connectionString }, apiRoot);
  const afterInspection = await inspectDatabase(connectionString);
  assertManagedMigrationState(afterInspection.state, afterInspection.unknownMigrations, afterInspection.failedMigrations);
  if (afterInspection.pendingMigrations.length) {
    throw new Error(`Migrations remain pending after deploy: ${afterInspection.pendingMigrations.join(', ')}`);
  }
  const after = await captureSnapshot(connectionString, afterInspection);
  const afterPath = resolve(defaultBackupDir, `post-migration-${sanitizeFilename(target.database)}-${safeTimestamp()}.json`);
  await writeJsonExclusive(afterPath, after);
  const reconciliation = reconcileSnapshots(before, after);
  if (!reconciliation.matches) {
    throw new Error(`Post-migration reconciliation failed: ${reconciliation.differences.join('; ')}`);
  }
  console.log(`Migration deploy and reconciliation succeeded for ${target.database}`);
  console.log(`Before snapshot: ${beforePath}`);
  console.log(`After snapshot: ${afterPath}`);
}

async function reconcileCommand(beforeFile: string, afterFile: string) {
  const before = JSON.parse(await readFile(resolve(beforeFile), 'utf8')) as DatabaseSnapshot;
  const after = JSON.parse(await readFile(resolve(afterFile), 'utf8')) as DatabaseSnapshot;
  const result = reconcileSnapshots(before, after);
  printJson(result);
  if (!result.matches) throw new Error('Database snapshots do not reconcile');
}

async function loadAndVerifyManifest(manifestFile: string) {
  const manifestPath = resolve(manifestFile);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BackupManifest;
  if (manifest.formatVersion !== 1 || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    throw new Error('Invalid backup manifest format');
  }
  const backupPath = resolve(dirname(manifestPath), manifest.backupFile);
  if (relative(dirname(manifestPath), backupPath).startsWith('..') || isAbsolute(manifest.backupFile)) {
    throw new Error('Backup manifest may reference only a file beside the manifest');
  }
  await assertNonEmptyFile(backupPath);
  const actualHash = await sha256File(backupPath);
  if (actualHash !== manifest.sha256) throw new Error('Backup SHA-256 does not match its manifest');
  const snapshotPath = resolve(dirname(manifestPath), manifest.snapshotFile);
  if (relative(dirname(manifestPath), snapshotPath).startsWith('..') || isAbsolute(manifest.snapshotFile)) {
    throw new Error('Backup manifest may reference only a snapshot beside the manifest');
  }
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as DatabaseSnapshot;
  if (snapshot.formatVersion !== 1) throw new Error('Invalid backup snapshot format');
  return { manifest, manifestPath, backupPath, snapshotPath, snapshot };
}

function assertManifestMatchesTarget(manifest: BackupManifest, target: DatabaseTarget) {
  if (manifest.source.host !== target.host || manifest.source.port !== target.port || manifest.source.database !== target.database) {
    throw new Error('Backup manifest does not belong to the migration target');
  }
}

function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 7_500,
    statement_timeout: 30_000,
    application_name: 'saraya-database-lifecycle',
    max: 2,
  });
}

function connectionArgs(target: DatabaseTarget) {
  return ['--host', target.host, '--port', String(target.port), '--username', target.user, '--dbname', target.database];
}

function targetEnvironment(target: DatabaseTarget): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, PGAPPNAME: 'saraya-database-lifecycle' };
  if (target.password) environment.PGPASSWORD = target.password;
  else delete environment.PGPASSWORD;
  if (target.sslMode) environment.PGSSLMODE = target.sslMode;
  return environment;
}

async function migrationDirectories() {
  const entries = await readdir(resolve(apiRoot, 'prisma/migrations'), { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

async function runTool(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  cwd = apiRoot,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd, env: environment, windowsHide: true, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(new Error(`Unable to start ${basename(executable)}: ${error.message}`)));
    child.on('close', code => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${basename(executable)} failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

async function resolvePostgresTool(
  tool: 'pg_dump' | 'pg_restore',
  environmentName: 'PG_DUMP_PATH' | 'PG_RESTORE_PATH',
  serverMajor: number,
) {
  const executableName = process.platform === 'win32' ? `${tool}.exe` : tool;
  const candidates = [
    process.env[environmentName],
    tool,
    process.platform === 'win32'
      ? `C:\\Program Files\\PostgreSQL\\${serverMajor}\\bin\\${executableName}`
      : undefined,
  ].filter((candidate, index, values): candidate is string => Boolean(candidate) && values.indexOf(candidate) === index);
  const failures: string[] = [];
  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      try {
        await access(candidate);
      } catch {
        failures.push(`${candidate}: not found`);
        continue;
      }
    }
    try {
      const version = await runTool(candidate, ['--version']);
      const major = parsePostgresMajor(version.stdout || version.stderr);
      assertCompatibleDumpTool(major, serverMajor);
      return candidate;
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No compatible ${tool} found for PostgreSQL ${serverMajor}. ${failures.join(' | ')}`);
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolvePromise);
  });
  return hash.digest('hex');
}

async function assertNonEmptyFile(filePath: string) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size === 0) throw new Error(`Expected a non-empty file: ${filePath}`);
}

async function writeJsonExclusive(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function requiredUrl(name: 'DATABASE_URL' | 'RESTORE_DATABASE_URL') {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function restoreUrl() {
  if (process.env.RESTORE_DATABASE_URL?.trim()) return process.env.RESTORE_DATABASE_URL.trim();
  const databaseName = process.env.RESTORE_DATABASE_NAME?.trim();
  if (!databaseName || !/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error('Configure RESTORE_DATABASE_URL or a safe RESTORE_DATABASE_NAME');
  }
  const source = new URL(requiredUrl('DATABASE_URL'));
  source.pathname = `/${databaseName}`;
  return source.toString();
}

function migrationUrl() {
  if (process.env.MIGRATION_DATABASE_URL?.trim()) return process.env.MIGRATION_DATABASE_URL.trim();
  const databaseName = process.env.MIGRATION_DATABASE_NAME?.trim();
  if (!databaseName) return requiredUrl('DATABASE_URL');
  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) throw new Error('MIGRATION_DATABASE_NAME is unsafe');
  const source = new URL(requiredUrl('DATABASE_URL'));
  source.pathname = `/${databaseName}`;
  return source.toString();
}

function parseArguments(args: string[]) {
  const flags: Record<string, string | undefined> = {};
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    flags[key] = value;
    index += 1;
  }
  return { flags, positional };
}

function requiredPosition(values: string[], index: number, label: string) {
  const value = values[index];
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch(error => {
  console.error(`Database lifecycle command failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
