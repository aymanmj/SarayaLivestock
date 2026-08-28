import 'dotenv/config';
import { randomUUID } from 'crypto';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Pool, PoolClient } from 'pg';
import {
  assertConfirmedTarget,
  parseDatabaseEnvironment,
  parseDatabaseTarget,
  publicTarget,
} from './database-lifecycle-core';
import {
  assertDistinctDatabaseTargets,
  compareNameSets,
  createRowDigest,
  deriveJournalNextNumber,
  FormulaOwnershipEvidence,
  JournalNumberEvidence,
  normalizePeriodBoundary,
  resolveFormulaOwnership,
} from './prototype-adoption-core';

type Row = Record<string, any>;
type AdoptionMode = 'dry-run' | 'execute';

interface TableSpec {
  table: string;
  sourceColumns: string[];
  targetColumns?: string[];
}

interface AdoptionIssue {
  code: string;
  count: number;
  entityIds: string[];
}

interface AdoptionReport {
  formatVersion: 1;
  generatedAt: string;
  mode: AdoptionMode;
  status: 'CHECKING' | 'REJECTED' | 'READY' | 'COMPLETED' | 'FAILED';
  source: ReturnType<typeof publicTarget>;
  target: ReturnType<typeof publicTarget>;
  writesStopped: boolean;
  expectedMigrations: string[];
  appliedMigrations: string[];
  sourceRowCounts: Record<string, number>;
  importedRowCounts: Record<string, number>;
  transformations: Record<string, number>;
  sourceDigests: Record<string, { rows: number; sha256: string }>;
  targetDigests: Record<string, { rows: number; sha256: string }>;
  issues: AdoptionIssue[];
  failure?: string;
}

const specs: TableSpec[] = [
  table('organizations', ['id', 'name', 'taxNumber', 'phone', 'planType', 'createdAt', 'updatedAt']),
  table('farms', ['id', 'orgId', 'name', 'location', 'managerName', 'phone', 'timezone', 'createdAt', 'updatedAt']),
  table('barns', ['id', 'farmId', 'name', 'sectorType', 'capacity', 'createdAt', 'updatedAt']),
  table('users', ['id', 'orgId', 'farmId', 'username', 'email', 'password', 'fullName', 'role', 'isActive', 'createdAt', 'updatedAt']),
  table('animals', ['id', 'farmId', 'barnId', 'tagNumber', 'rfidTag', 'name', 'species', 'breed', 'gender', 'purpose', 'status', 'currentLifeStage', 'birthDate', 'entryDate', 'entryWeightKg', 'purchasePrice', 'motherId', 'fatherSemenCode', 'withdrawalEndDate', 'createdAt', 'updatedAt']),
  table('milk_logs', ['id', 'animalId', 'logDate', 'shift', 'yieldLiters', 'fatPct', 'proteinPct', 'isDiscarded', 'discardReason', 'loggedByUserId', 'createdAt']),
  table('bulk_tank_logs', ['id', 'farmId', 'logDate', 'totalYieldLiters', 'soldLiters', 'calfFeedingLiters', 'wastedLiters', 'tankTemperature', 'fatPctAvg', 'proteinPctAvg', 'unitPrice', 'buyerName', 'invoiceNumber', 'createdAt']),
  table('weight_logs', ['id', 'animalId', 'weighDate', 'weightKg', 'dailyGainAdg', 'daysSinceLast', 'notes', 'createdAt']),
  table('breeding_records', ['id', 'animalId', 'inseminationDate', 'inseminationType', 'semenCode', 'inseminatorName', 'pdCheckDate', 'pdResult', 'expectedCalvingDate', 'expectedDryoffDate', 'actualCalvingDate', 'calvingDifficulty', 'offspringCount', 'offspringGender', 'notes', 'createdAt', 'updatedAt']),
  table('health_treatments', ['id', 'animalId', 'diagnosis', 'drugName', 'dosage', 'treatmentDate', 'milkWithdrawalDays', 'meatWithdrawalDays', 'withdrawalEndDate', 'vetName', 'treatmentCost', 'isCompleted', 'notes', 'createdAt']),
  table('feed_ingredients', ['id', 'farmId', 'name', 'unit', 'currentStock', 'minStockAlert', 'costPerUnit', 'dryMatterPct', 'proteinPct', 'energyMcal', 'createdAt', 'updatedAt']),
  {
    table: 'feed_formulas',
    sourceColumns: ['id', 'name', 'targetSector', 'description', 'createdAt', 'updatedAt'],
    targetColumns: ['id', 'farmId', 'name', 'targetSector', 'description', 'createdAt', 'updatedAt'],
  },
  table('feed_formula_items', ['id', 'formulaId', 'ingredientId', 'percentage']),
  table('feed_distributions', ['id', 'barnId', 'formulaId', 'dispenseDate', 'quantityKg', 'totalCost', 'createdAt']),
  table('cost_centers', ['id', 'farmId', 'name', 'type', 'createdAt']),
  table('financial_transactions', ['id', 'costCenterId', 'transDate', 'type', 'category', 'amount', 'description', 'referenceId', 'createdAt']),
  table('fiscal_years', ['id', 'farmId', 'yearName', 'startDate', 'endDate', 'status', 'isCurrent', 'closedAt', 'closedBy', 'createdAt', 'updatedAt']),
  table('fiscal_periods', ['id', 'fiscalYearId', 'periodNumber', 'periodName', 'startDate', 'endDate', 'status', 'closedAt', 'createdAt']),
  table('accounts', ['id', 'farmId', 'code', 'name', 'nameEn', 'category', 'parentId', 'currentBalance', 'isActive', 'isSystemLocked', 'createdAt', 'updatedAt']),
  table('journal_entries', ['id', 'farmId', 'fiscalYearId', 'fiscalPeriodId', 'entryNumber', 'entryDate', 'type', 'status', 'description', 'referenceId', 'totalDebit', 'totalCredit', 'postedAt', 'postedBy', 'createdAt', 'updatedAt']),
  table('journal_entry_lines', ['id', 'journalEntryId', 'accountId', 'costCenterId', 'debit', 'credit', 'memo']),
];

const sourceTables = specs.map(spec => spec.table).sort();
const targetTables = [...sourceTables, 'audit_events', 'journal_sequences', 'user_sessions', 'idempotency_records'].sort();
const apiRoot = resolve(process.cwd());
const repositoryRoot = resolve(apiRoot, '../..');
const reportDirectory = resolve(repositoryRoot, 'backups');

async function main() {
  const mode = process.argv[2] as AdoptionMode;
  if (mode !== 'dry-run' && mode !== 'execute') {
    throw new Error('Usage: prototype-adoption <dry-run|execute> [--output report.json]');
  }
  const output = flagValue(process.argv.slice(3), '--output');
  await adopt(mode, output);
}

async function adopt(mode: AdoptionMode, output?: string) {
  const sourceUrl = requiredUrl('DATABASE_URL');
  const targetUrl = adoptionUrl(sourceUrl);
  const sourceTarget = parseDatabaseTarget(sourceUrl);
  const adoptionTarget = parseDatabaseTarget(targetUrl);
  assertDistinctDatabaseTargets(sourceTarget, adoptionTarget);
  const environment = parseDatabaseEnvironment(process.env.SARAYA_DB_ENV);
  if (environment === 'development') throw new Error('Prototype adoption is reserved for staging or production');
  assertConfirmedTarget(adoptionTarget, environment, process.env.SARAYA_DB_CONFIRM);
  if (mode === 'execute') {
    if (process.env.SARAYA_DB_WRITES_STOPPED !== 'true') {
      throw new Error('Set SARAYA_DB_WRITES_STOPPED=true only after all source application writes have stopped');
    }
    if (process.env.SARAYA_ADOPTION_EXECUTE !== 'true') {
      throw new Error('Set SARAYA_ADOPTION_EXECUTE=true to authorize the transactional import');
    }
  }

  const expectedMigrations = await migrationDirectories();
  const report: AdoptionReport = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    status: 'CHECKING',
    source: publicTarget(sourceTarget),
    target: publicTarget(adoptionTarget),
    writesStopped: process.env.SARAYA_DB_WRITES_STOPPED === 'true',
    expectedMigrations,
    appliedMigrations: [],
    sourceRowCounts: {},
    importedRowCounts: {},
    transformations: {},
    sourceDigests: {},
    targetDigests: {},
    issues: [],
  };
  const reportPath = output ? resolve(output) : resolve(reportDirectory, `adoption-${safeName(adoptionTarget.database)}-${safeTimestamp()}.json`);
  let reportWritten = false;
  const sourcePool = pool(sourceUrl, 'saraya-adoption-source');
  const targetPool = pool(targetUrl, 'saraya-adoption-target');
  let source: PoolClient | undefined;
  let target: PoolClient | undefined;

  try {
    source = await sourcePool.connect();
    target = await targetPool.connect();
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await target.query(mode === 'execute'
      ? 'BEGIN ISOLATION LEVEL SERIALIZABLE'
      : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if (mode === 'execute') {
      const lock = await target.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext('saraya-prototype-adoption')) AS locked`,
      );
      if (!lock.rows[0].locked) throw new Error('Another prototype adoption is already running on the target');
    }

    const context = await preflight(source, target, expectedMigrations, report);
    if (report.issues.length) {
      report.status = 'REJECTED';
      await writeReport(reportPath, report);
      reportWritten = true;
      throw new Error(`Adoption rejected by ${report.issues.length} preflight rule(s); see ${reportPath}`);
    }

    report.sourceDigests = await digestSource(source, context);
    if (mode === 'dry-run') {
      report.status = 'READY';
      await source.query('COMMIT');
      await target.query('COMMIT');
      await writeReport(reportPath, report);
      reportWritten = true;
      console.log(`Prototype adoption dry run is READY: ${reportPath}`);
      return;
    }

    report.importedRowCounts = await importPrototype(source, target, context, report);
    report.targetDigests = await digestTarget(target);
    for (const spec of specs) {
      const expected = report.sourceDigests[spec.table];
      const actual = report.targetDigests[spec.table];
      if (!actual || expected.rows !== actual.rows || expected.sha256 !== actual.sha256) {
        report.issues.push({ code: `DIGEST_MISMATCH_${spec.table.toUpperCase()}`, count: 1, entityIds: [] });
      }
    }
    await verifyNewTables(target, context.journalEvidence.length, report);
    if (report.issues.length) throw new Error('Post-import reconciliation failed; target transaction was rolled back');

    await target.query('COMMIT');
    await source.query('COMMIT');
    report.status = 'COMPLETED';
    await writeReport(reportPath, report);
    reportWritten = true;
    console.log(`Prototype adoption completed and reconciled: ${reportPath}`);
  } catch (error) {
    await target?.query('ROLLBACK').catch(() => undefined);
    await source?.query('ROLLBACK').catch(() => undefined);
    if (!reportWritten) {
      report.status = report.issues.length ? 'REJECTED' : 'FAILED';
      report.failure = safeError(error);
      await writeReport(reportPath, report).then(() => { reportWritten = true; }).catch(() => undefined);
    }
    throw error;
  } finally {
    source?.release();
    target?.release();
    await Promise.all([sourcePool.end(), targetPool.end()]);
  }
}

interface AdoptionContext {
  formulaFarm: Map<string, string>;
  journalPeriod: Map<string, string>;
  journalEvidence: JournalNumberEvidence[];
  periodBoundaries: Map<string, { startDate: Date; endDate: Date }>;
}

async function preflight(
  source: PoolClient,
  target: PoolClient,
  expectedMigrations: string[],
  report: AdoptionReport,
): Promise<AdoptionContext> {
  const sourceSchema = await schemaMetadata(source);
  const targetSchema = await schemaMetadata(target);
  addSetIssues(report, 'SOURCE_TABLE', compareNameSets(sourceSchema.tables, sourceTables));
  addSetIssues(report, 'TARGET_TABLE', compareNameSets(targetSchema.tables, targetTables));
  if (sourceSchema.hasMigrations) addIssue(report, 'SOURCE_MUST_BE_UNMANAGED', 1);
  if (!targetSchema.hasMigrations) addIssue(report, 'TARGET_MIGRATION_HISTORY_MISSING', 1);

  if (!report.issues.length) {
    for (const spec of specs) {
      addSetIssues(report, `SOURCE_COLUMN_${spec.table.toUpperCase()}`,
        compareNameSets(sourceSchema.columns.get(spec.table) || [], spec.sourceColumns));
      addSetIssues(report, `TARGET_COLUMN_${spec.table.toUpperCase()}`,
        compareNameSets(targetSchema.columns.get(spec.table) || [], spec.targetColumns || spec.sourceColumns));
    }
  }

  if (targetSchema.hasMigrations) {
    const migrationRows = (await target.query<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>(`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at
    `)).rows;
    report.appliedMigrations = migrationRows
      .filter(row => row.finished_at && !row.rolled_back_at)
      .map(row => row.migration_name);
    addSetIssues(report, 'TARGET_MIGRATION', compareNameSets(report.appliedMigrations, expectedMigrations));
    const failed = migrationRows.filter(row => !row.finished_at && !row.rolled_back_at);
    if (failed.length) addIssue(report, 'TARGET_FAILED_MIGRATIONS', failed.length, failed.map(row => row.migration_name));
  }

  if (targetSchema.tables.length) {
    for (const tableName of targetSchema.tables) {
      const count = Number((await target.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quote(tableName)}`)).rows[0].count);
      if (count) addIssue(report, 'TARGET_NOT_EMPTY', count, [tableName]);
    }
  }
  if (report.issues.length) return {
    formulaFarm: new Map(), journalPeriod: new Map(), journalEvidence: [], periodBoundaries: new Map(),
  };

  for (const spec of specs) {
    report.sourceRowCounts[spec.table] = Number((await source.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${quote(spec.table)}`,
    )).rows[0].count);
  }

  const farmIds = (await source.query<{ id: string }>('SELECT id FROM farms ORDER BY id')).rows.map(row => row.id);
  const formulaEvidence = await loadFormulaEvidence(source);
  const formulaResolution = resolveFormulaOwnership(formulaEvidence, farmIds);
  for (const issue of formulaResolution.issues) addIssue(report, issue.code, 1, [issue.entityId]);
  const formulaRows = (await source.query<{ id: string; name: string }>('SELECT id, name FROM feed_formulas ORDER BY id')).rows;
  const formulaNames = new Map<string, string[]>();
  for (const formula of formulaRows) {
    const farmId = formulaResolution.ownership.get(formula.id);
    if (!farmId) continue;
    const key = `${farmId}\u0000${formula.name}`;
    formulaNames.set(key, [...(formulaNames.get(key) || []), formula.id]);
  }
  for (const ids of formulaNames.values()) {
    if (ids.length > 1) addIssue(report, 'FORMULA_NAME_COLLISION_AFTER_OWNERSHIP_BACKFILL', ids.length, ids);
  }

  await addSqlIssue(source, report, 'USER_FARM_ORG_MISMATCH', `
    SELECT u.id FROM users u JOIN farms f ON f.id = u."farmId"
    WHERE u."farmId" IS NOT NULL AND u."orgId" <> f."orgId"`);
  await addSqlIssue(source, report, 'ANIMAL_BARN_FARM_MISMATCH', `
    SELECT a.id FROM animals a JOIN barns b ON b.id = a."barnId"
    WHERE a."barnId" IS NOT NULL AND a."farmId" <> b."farmId"`);
  await addSqlIssue(source, report, 'ANIMAL_MOTHER_FARM_MISMATCH', `
    SELECT a.id FROM animals a JOIN animals m ON m.id = a."motherId"
    WHERE a."motherId" IS NOT NULL AND (a.id = a."motherId" OR a."farmId" <> m."farmId")`);
  await addSqlIssue(source, report, 'MILK_LOGGER_ORG_MISMATCH', `
    SELECT l.id FROM milk_logs l
    JOIN animals a ON a.id = l."animalId" JOIN farms f ON f.id = a."farmId"
    JOIN users u ON u.id = l."loggedByUserId"
    WHERE l."loggedByUserId" IS NOT NULL AND u."orgId" <> f."orgId"`);
  await addSqlIssue(source, report, 'INVALID_PASSWORD_HASH', `
    SELECT id FROM users WHERE password !~ '^\\$2[aby]\\$[0-9]{2}\\$.{53}$'`);
  const periodBoundaries = await resolvePeriodBoundaries(source, report);
  await addSqlIssue(source, report, 'JOURNAL_YEAR_FARM_OR_DATE_MISMATCH', `
    SELECT j.id FROM journal_entries j JOIN fiscal_years y ON y.id = j."fiscalYearId"
    WHERE j."farmId" <> y."farmId" OR j."entryDate" < y."startDate" OR j."entryDate" > y."endDate"`);
  await addSqlIssue(source, report, 'JOURNAL_PERIOD_MISMATCH', `
    SELECT j.id FROM journal_entries j JOIN fiscal_periods p ON p.id = j."fiscalPeriodId"
    WHERE j."fiscalPeriodId" IS NOT NULL
      AND (j."fiscalYearId" <> p."fiscalYearId" OR j."entryDate" < p."startDate" OR j."entryDate" > p."endDate")`);
  await addSqlIssue(source, report, 'UNBALANCED_JOURNAL_HEADER', `
    SELECT id FROM journal_entries WHERE "totalDebit" <> "totalCredit"`);
  await addSqlIssue(source, report, 'JOURNAL_LINE_TOTAL_MISMATCH', `
    SELECT j.id FROM journal_entries j
    LEFT JOIN (SELECT "journalEntryId", COALESCE(SUM(debit), 0) debit, COALESCE(SUM(credit), 0) credit
      FROM journal_entry_lines GROUP BY "journalEntryId") l ON l."journalEntryId" = j.id
    WHERE j."totalDebit" <> COALESCE(l.debit, 0) OR j."totalCredit" <> COALESCE(l.credit, 0)`);
  await addSqlIssue(source, report, 'JOURNAL_ACCOUNT_FARM_MISMATCH', `
    SELECT l.id FROM journal_entry_lines l JOIN journal_entries j ON j.id = l."journalEntryId"
    JOIN accounts a ON a.id = l."accountId" WHERE j."farmId" <> a."farmId"`);
  await addSqlIssue(source, report, 'JOURNAL_COST_CENTER_FARM_MISMATCH', `
    SELECT l.id FROM journal_entry_lines l JOIN journal_entries j ON j.id = l."journalEntryId"
    JOIN cost_centers c ON c.id = l."costCenterId"
    WHERE l."costCenterId" IS NOT NULL AND j."farmId" <> c."farmId"`);
  await addSqlIssue(source, report, 'ACCOUNT_PARENT_FARM_MISMATCH', `
    SELECT a.id FROM accounts a JOIN accounts p ON p.id = a."parentId"
    WHERE a."parentId" IS NOT NULL AND (a.id = a."parentId" OR a."farmId" <> p."farmId")`);

  const animalParents = (await source.query<{ id: string; parentId: string | null }>(
    `SELECT id, "motherId" AS "parentId" FROM animals ORDER BY id`,
  )).rows;
  const accountParents = (await source.query<{ id: string; parentId: string | null }>(
    `SELECT id, "parentId" FROM accounts ORDER BY id`,
  )).rows;
  addCycles(report, 'ANIMAL_MATERNAL_CYCLE', animalParents);
  addCycles(report, 'ACCOUNT_HIERARCHY_CYCLE', accountParents);

  const journalPeriod = await resolveJournalPeriods(source, report);
  const journalEvidence = await loadJournalEvidence(source);
  report.transformations.formulaFarmOwnershipBackfilled = formulaResolution.ownership.size;
  report.transformations.journalPeriodsBackfilled = [...journalPeriod.values()].length;
  report.transformations.journalSequencesCreated = journalEvidence.length;
  report.transformations.fiscalPeriodBoundariesNormalized = periodBoundaries.size;
  report.transformations.animalMotherLinksDeferred = animalParents.filter(row => row.parentId).length;
  report.transformations.accountParentLinksDeferred = accountParents.filter(row => row.parentId).length;
  return { formulaFarm: formulaResolution.ownership, journalPeriod, journalEvidence, periodBoundaries };
}

async function importPrototype(
  source: PoolClient,
  target: PoolClient,
  context: AdoptionContext,
  report: AdoptionReport,
) {
  const counts: Record<string, number> = {};
  for (const spec of specs) {
    counts[spec.table] = await copyTable(source, target, spec, row => transformRow(spec.table, row, context));
  }
  await restoreLinks(source, target, 'animals', 'motherId');
  await restoreLinks(source, target, 'accounts', 'parentId');
  await restoreFiscalState(source, target, 'fiscal_years', ['status', 'closedAt']);
  await restoreFiscalState(source, target, 'fiscal_periods', ['status', 'closedAt']);
  if (context.journalEvidence.length) {
    const now = new Date();
    const sequenceRows = context.journalEvidence.map(evidence => ({
      id: randomUUID(), farmId: evidence.farmId, fiscalYearId: evidence.fiscalYearId,
      nextNumber: deriveJournalNextNumber(evidence), createdAt: now, updatedAt: now,
    }));
    await insertRows(target, 'journal_sequences', ['id', 'farmId', 'fiscalYearId', 'nextNumber', 'createdAt', 'updatedAt'], sequenceRows);
  }
  counts.journal_sequences = context.journalEvidence.length;
  counts.audit_events = 0;
  counts.user_sessions = 0;
  counts.idempotency_records = 0;
  if (Object.entries(report.sourceRowCounts).some(([name, count]) => counts[name] !== count)) {
    addIssue(report, 'IMPORT_ROW_COUNT_MISMATCH', 1);
  }
  return counts;
}

function transformRow(tableName: string, row: Row, context: AdoptionContext) {
  if (tableName === 'feed_formulas') return { ...row, farmId: context.formulaFarm.get(row.id) };
  if (tableName === 'animals') return { ...row, motherId: null };
  if (tableName === 'accounts') return { ...row, parentId: null };
  if (tableName === 'fiscal_years' || tableName === 'fiscal_periods') {
    const boundary = tableName === 'fiscal_periods' ? context.periodBoundaries.get(row.id) : undefined;
    return { ...row, ...boundary, status: 'OPEN', closedAt: null };
  }
  if (tableName === 'journal_entries' && !row.fiscalPeriodId) {
    return { ...row, fiscalPeriodId: context.journalPeriod.get(row.id) };
  }
  return row;
}

async function copyTable(
  source: PoolClient,
  target: PoolClient,
  spec: TableSpec,
  transform: (row: Row) => Row,
) {
  let count = 0;
  await forEachPage(source, spec.table, spec.sourceColumns, async rows => {
    const transformed = rows.map(transform);
    await insertRows(target, spec.table, spec.targetColumns || spec.sourceColumns, transformed);
    count += rows.length;
  });
  return count;
}

async function insertRows(client: PoolClient, tableName: string, columns: string[], rows: Row[]) {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    const values: unknown[] = [];
    const tuples = batch.map(row => {
      const placeholders = columns.map(column => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${quote(tableName)} (${columns.map(quote).join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }
}

async function restoreLinks(source: PoolClient, target: PoolClient, tableName: 'animals' | 'accounts', column: 'motherId' | 'parentId') {
  const rows = (await source.query<{ id: string; parentId: string }>(
    `SELECT id, ${quote(column)} AS "parentId" FROM ${quote(tableName)} WHERE ${quote(column)} IS NOT NULL ORDER BY id`,
  )).rows;
  for (const row of rows) {
    await target.query(`UPDATE ${quote(tableName)} SET ${quote(column)} = $2 WHERE id = $1`, [row.id, row.parentId]);
  }
}

async function restoreFiscalState(
  source: PoolClient,
  target: PoolClient,
  tableName: 'fiscal_years' | 'fiscal_periods',
  columns: string[],
) {
  const rows = (await source.query<Row>(
    `SELECT id, ${columns.map(quote).join(', ')} FROM ${quote(tableName)} ORDER BY id`,
  )).rows;
  for (const row of rows) {
    await target.query(
      `UPDATE ${quote(tableName)} SET ${columns.map((column, index) => `${quote(column)} = $${index + 2}`).join(', ')} WHERE id = $1`,
      [row.id, ...columns.map(column => row[column])],
    );
  }
}

async function digestSource(source: PoolClient, context: AdoptionContext) {
  const output: AdoptionReport['sourceDigests'] = {};
  for (const spec of specs) {
    const digest = createRowDigest();
    await forEachPage(source, spec.table, spec.sourceColumns, async rows => {
      for (const sourceRow of rows) {
        const row = expectedFinalRow(spec.table, sourceRow, context);
        digest.update((spec.targetColumns || spec.sourceColumns).map(column => row[column]));
      }
    });
    output[spec.table] = digest.finish();
  }
  return output;
}

async function digestTarget(target: PoolClient) {
  const output: AdoptionReport['targetDigests'] = {};
  for (const spec of specs) {
    const columns = spec.targetColumns || spec.sourceColumns;
    const digest = createRowDigest();
    await forEachPage(target, spec.table, columns, async rows => {
      for (const row of rows) digest.update(columns.map(column => row[column]));
    });
    output[spec.table] = digest.finish();
  }
  return output;
}

function expectedFinalRow(tableName: string, row: Row, context: AdoptionContext) {
  if (tableName === 'feed_formulas') return { ...row, farmId: context.formulaFarm.get(row.id) };
  if (tableName === 'fiscal_periods') return { ...row, ...context.periodBoundaries.get(row.id) };
  if (tableName === 'journal_entries' && !row.fiscalPeriodId) {
    return { ...row, fiscalPeriodId: context.journalPeriod.get(row.id) };
  }
  return row;
}

async function verifyNewTables(target: PoolClient, sequenceCount: number, report: AdoptionReport) {
  for (const tableName of ['audit_events', 'user_sessions', 'idempotency_records']) {
    const count = Number((await target.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quote(tableName)}`)).rows[0].count);
    if (count !== 0) addIssue(report, `UNEXPECTED_${tableName.toUpperCase()}_ROWS`, count);
  }
  const actualSequences = Number((await target.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM journal_sequences',
  )).rows[0].count);
  if (actualSequences !== sequenceCount) addIssue(report, 'JOURNAL_SEQUENCE_COUNT_MISMATCH', 1);
}

async function loadFormulaEvidence(source: PoolClient): Promise<FormulaOwnershipEvidence[]> {
  return (await source.query<FormulaOwnershipEvidence>(`
    SELECT f.id AS "formulaId",
      COALESCE((SELECT array_agg(DISTINCT g."farmId" ORDER BY g."farmId")
        FROM feed_formula_items i JOIN feed_ingredients g ON g.id = i."ingredientId"
        WHERE i."formulaId" = f.id), ARRAY[]::text[]) AS "ingredientFarmIds",
      COALESCE((SELECT array_agg(DISTINCT b."farmId" ORDER BY b."farmId")
        FROM feed_distributions d JOIN barns b ON b.id = d."barnId"
        WHERE d."formulaId" = f.id), ARRAY[]::text[]) AS "distributionFarmIds"
    FROM feed_formulas f ORDER BY f.id
  `)).rows;
}

async function resolveJournalPeriods(source: PoolClient, report: AdoptionReport) {
  const resolution = new Map<string, string>();
  const rows = (await source.query<{ id: string; periodIds: string[] }>(`
    SELECT j.id,
      COALESCE(array_agg(p.id ORDER BY p."periodNumber") FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) AS "periodIds"
    FROM journal_entries j
    LEFT JOIN fiscal_periods p ON p."fiscalYearId" = j."fiscalYearId"
      AND p."startDate" <= j."entryDate" AND p."endDate" >= j."entryDate"
    WHERE j."fiscalPeriodId" IS NULL
    GROUP BY j.id ORDER BY j.id
  `)).rows;
  for (const row of rows) {
    if (row.periodIds.length !== 1) addIssue(report, 'JOURNAL_PERIOD_BACKFILL_AMBIGUOUS', 1, [row.id]);
    else resolution.set(row.id, row.periodIds[0]);
  }
  return resolution;
}

async function resolvePeriodBoundaries(source: PoolClient, report: AdoptionReport) {
  const boundaries = new Map<string, { startDate: Date; endDate: Date }>();
  const rows = (await source.query<{
    id: string; periodStart: Date; periodEnd: Date; yearStart: Date; yearEnd: Date;
  }>(`
    SELECT p.id, p."startDate" AS "periodStart", p."endDate" AS "periodEnd",
      y."startDate" AS "yearStart", y."endDate" AS "yearEnd"
    FROM fiscal_periods p JOIN fiscal_years y ON y.id = p."fiscalYearId"
    WHERE p."startDate" > p."endDate" OR p."startDate" < y."startDate" OR p."endDate" > y."endDate"
    ORDER BY p.id
  `)).rows;
  const normalizationAuthorized = process.env.SARAYA_ADOPTION_NORMALIZE_PERIOD_BOUNDARIES === 'true';
  for (const row of rows) {
    const normalized = normalizePeriodBoundary(row.periodStart, row.periodEnd, row.yearStart, row.yearEnd);
    if (!normalizationAuthorized || !normalized?.changed) {
      addIssue(report, 'FISCAL_PERIOD_OUTSIDE_YEAR', 1, [row.id]);
      continue;
    }
    const affected = Number((await source.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM journal_entries
      WHERE "fiscalPeriodId" = $1 AND ("entryDate" < $2 OR "entryDate" > $3)
    `, [row.id, normalized.startDate, normalized.endDate])).rows[0].count);
    if (affected) {
      addIssue(report, 'FISCAL_PERIOD_NORMALIZATION_WOULD_EXCLUDE_JOURNALS', affected, [row.id]);
      continue;
    }
    boundaries.set(row.id, { startDate: normalized.startDate, endDate: normalized.endDate });
  }
  return boundaries;
}

async function loadJournalEvidence(source: PoolClient): Promise<JournalNumberEvidence[]> {
  return (await source.query<JournalNumberEvidence>(`
    SELECT y."farmId", y.id AS "fiscalYearId", y."yearName",
      COALESCE(array_agg(j."entryNumber" ORDER BY j."entryNumber") FILTER (WHERE j.id IS NOT NULL), ARRAY[]::text[]) AS "entryNumbers"
    FROM fiscal_years y LEFT JOIN journal_entries j ON j."fiscalYearId" = y.id AND j."farmId" = y."farmId"
    GROUP BY y."farmId", y.id, y."yearName" ORDER BY y."farmId", y.id
  `)).rows;
}

async function addSqlIssue(client: PoolClient, report: AdoptionReport, code: string, innerQuery: string) {
  const result = (await client.query<{ count: string; ids: string[] }>(`
    SELECT COUNT(*)::text AS count,
      COALESCE((array_agg(id::text ORDER BY id::text))[1:100], ARRAY[]::text[]) AS ids
    FROM (${innerQuery}) adoption_issue
  `)).rows[0];
  const count = Number(result.count);
  if (count) addIssue(report, code, count, result.ids);
}

function addCycles(report: AdoptionReport, code: string, rows: Array<{ id: string; parentId: string | null }>) {
  const parents = new Map(rows.map(row => [row.id, row.parentId]));
  const cyclic = new Set<string>();
  for (const start of parents.keys()) {
    const path = new Set<string>();
    let current: string | null | undefined = start;
    while (current && parents.has(current)) {
      if (path.has(current)) {
        cyclic.add(start);
        break;
      }
      path.add(current);
      current = parents.get(current);
    }
  }
  if (cyclic.size) addIssue(report, code, cyclic.size, [...cyclic].sort().slice(0, 100));
}

async function schemaMetadata(client: PoolClient) {
  const tableRows = (await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
  `)).rows;
  const allTables = tableRows.map(row => row.table_name);
  const columns = new Map<string, string[]>();
  const columnRows = (await client.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position
  `)).rows;
  for (const row of columnRows) columns.set(row.table_name, [...(columns.get(row.table_name) || []), row.column_name]);
  return {
    hasMigrations: allTables.includes('_prisma_migrations'),
    tables: allTables.filter(name => name !== '_prisma_migrations'),
    columns,
  };
}

async function forEachPage(
  client: PoolClient,
  tableName: string,
  columns: string[],
  consume: (rows: Row[]) => Promise<void>,
) {
  let afterId: string | undefined;
  while (true) {
    const result = await client.query<Row>(
      `SELECT ${columns.map(quote).join(', ')} FROM ${quote(tableName)}
       ${afterId === undefined ? '' : 'WHERE id > $1'} ORDER BY id LIMIT 500`,
      afterId === undefined ? [] : [afterId],
    );
    if (!result.rows.length) return;
    await consume(result.rows);
    afterId = result.rows[result.rows.length - 1].id;
  }
}

function addSetIssues(report: AdoptionReport, prefix: string, comparison: { missing: string[]; unexpected: string[] }) {
  if (comparison.missing.length) addIssue(report, `${prefix}_MISSING`, comparison.missing.length, comparison.missing);
  if (comparison.unexpected.length) addIssue(report, `${prefix}_UNEXPECTED`, comparison.unexpected.length, comparison.unexpected);
}

function addIssue(report: AdoptionReport, code: string, count: number, entityIds: string[] = []) {
  report.issues.push({ code, count, entityIds: entityIds.slice(0, 100) });
}

function table(tableName: string, columns: string[]): TableSpec {
  return { table: tableName, sourceColumns: columns };
}

function quote(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function pool(connectionString: string, applicationName: string) {
  return new Pool({
    connectionString,
    application_name: applicationName,
    connectionTimeoutMillis: 7_500,
    statement_timeout: 120_000,
    max: 1,
  });
}

async function migrationDirectories() {
  const entries = await readdir(resolve(apiRoot, 'prisma/migrations'), { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function adoptionUrl(sourceUrl: string) {
  if (process.env.ADOPTION_DATABASE_URL?.trim()) return process.env.ADOPTION_DATABASE_URL.trim();
  const databaseName = process.env.ADOPTION_DATABASE_NAME?.trim();
  if (!databaseName || !/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error('Configure ADOPTION_DATABASE_URL or a safe ADOPTION_DATABASE_NAME');
  }
  const target = new URL(sourceUrl);
  target.pathname = `/${databaseName}`;
  return target.toString();
}

function requiredUrl(name: 'DATABASE_URL') {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function flagValue(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

async function writeReport(path: string, report: AdoptionReport) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database-url-redacted]').slice(0, 1000);
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

main().catch(error => {
  console.error(`Prototype adoption failed: ${safeError(error)}`);
  process.exitCode = 1;
});
