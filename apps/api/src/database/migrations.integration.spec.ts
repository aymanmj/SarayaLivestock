import { Pool, PoolClient } from 'pg';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PostgreSQL migration integrity guards', () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO "organizations" ("id", "name", "updatedAt")
      VALUES ('10000000-0000-4000-8000-000000000001', 'Migration Test', NOW());
      INSERT INTO "farms" ("id", "orgId", "name", "updatedAt")
      VALUES ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Farm', NOW());
      INSERT INTO "fiscal_years" ("id", "farmId", "yearName", "startDate", "endDate", "status", "isCurrent", "updatedAt")
      VALUES ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '2030', '2030-01-01', '2030-12-31', 'OPEN', TRUE, NOW());
      INSERT INTO "fiscal_periods" ("id", "fiscalYearId", "periodNumber", "periodName", "startDate", "endDate", "status")
      VALUES ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 1, 'January 2030', '2030-01-01', '2030-01-31', 'OPEN');
      INSERT INTO "accounts" ("id", "farmId", "code", "name", "category", "currentBalance", "updatedAt")
      VALUES ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', '1101', 'Cash', 'ASSET', 0, NOW());
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    if (pool) await pool.end();
  });

  it('assigns the open period and blocks mutation of posted journals and their lines', async () => {
    const inserted = await client.query(`
      INSERT INTO "journal_entries" (
        "id", "farmId", "fiscalYearId", "entryNumber", "entryDate", "type", "status",
        "description", "totalDebit", "totalCredit", "updatedAt"
      ) VALUES (
        '10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003', 'JV-2030-000001', '2030-01-10', 'MANUAL',
        'POSTED', 'Migration guard test', 10, 10, NOW()
      ) RETURNING "fiscalPeriodId";
      INSERT INTO "journal_entry_lines" ("id", "journalEntryId", "accountId", "debit", "credit")
      VALUES ('10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000006',
        '10000000-0000-4000-8000-000000000005', 10, 0);
    `);
    expect(inserted[0].rows[0].fiscalPeriodId).toBe('10000000-0000-4000-8000-000000000004');

    await expectGuardError(
      `UPDATE "journal_entries" SET "description" = 'tampered' WHERE "id" = '10000000-0000-4000-8000-000000000006'`,
      '55000',
    );
    await expectGuardError(
      `UPDATE "journal_entry_lines" SET "debit" = 9 WHERE "id" = '10000000-0000-4000-8000-000000000007'`,
      '55000',
    );
  });

  it('blocks writes to a closed fiscal period and deletion of audit evidence', async () => {
    await client.query(`UPDATE "fiscal_periods" SET "status" = 'CLOSED' WHERE "id" = '10000000-0000-4000-8000-000000000004'`);
    await expectGuardError(`
      INSERT INTO "journal_entries" (
        "id", "farmId", "fiscalYearId", "entryNumber", "entryDate", "type", "status",
        "description", "totalDebit", "totalCredit", "updatedAt"
      ) VALUES (
        '10000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003', 'JV-2030-000002', '2030-01-11', 'MANUAL',
        'POSTED', 'Must fail', 5, 5, NOW()
      )`,
      '23514',
    );

    await client.query(`
      INSERT INTO "audit_events" (
        "id", "orgId", "actorUserId", "action", "entityType", "httpMethod", "path", "statusCode"
      ) VALUES (
        '10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000010', 'POST /test', 'test', 'POST', '/test', 201
      )`);
    await expectGuardError(
      `DELETE FROM "audit_events" WHERE "id" = '10000000-0000-4000-8000-000000000009'`,
      '55000',
    );
  });

  async function expectGuardError(sql: string, code: string) {
    await client.query('SAVEPOINT expected_guard_error');
    try {
      await client.query(sql);
      throw new Error(`Expected PostgreSQL error ${code}`);
    } catch (error) {
      expect(error).toMatchObject({ code });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT expected_guard_error');
    }
  }
});
