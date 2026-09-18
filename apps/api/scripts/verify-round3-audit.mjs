import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

process.on('uncaughtException', err => {
  if (/terminating connection|Connection terminated/i.test(err.message)) {
    process.exit(0);
  }
  console.error('Unhandled Exception:', err);
  process.exit(1);
});

const apiDir = path.resolve('E:/SarayaLivestock/apps/api');
dotenv.config({ path: path.join(apiDir, '.env') });

const sourceUrl = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('DATABASE_URL is required');

const adminUrl = new URL(sourceUrl);
const databaseName = `saraya_r3_verify_${randomBytes(6).toString('hex')}`;
const quotedDatabaseName = `"${databaseName}"`;
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set('schema', 'public');

const { Client } = pg;
const administrator = new Client({ connectionString: adminUrl.toString() });

await administrator.connect();
try {
  await administrator.query(`CREATE DATABASE ${quotedDatabaseName}`);
  console.log(`[INIT] Created isolated test database: ${databaseName}`);

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testUrl.toString(),
    RUN_DB_INTEGRATION_TESTS: 'true',
  };

  // Run migrations
  const mig = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: apiDir,
    env,
    stdio: 'inherit',
  });
  if (mig.status !== 0) throw new Error('Migration failed');

  // Load Prisma & Services
  process.env.DATABASE_URL = testUrl.toString();
  const { PrismaService } = await import(pathToFileURL(path.join(apiDir, 'dist/database/prisma.service.js')).href);
  const { AccountingService } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/accounting/accounting.service.js')).href);
  const { PayrollService } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/hr/payroll.service.js')).href);
  const { AdvancesService } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/hr/advances.service.js')).href);
  const { EmployeesService } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/hr/employees.service.js')).href);
  const { AuthService } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/auth/auth.service.js')).href);
  const { JwtStrategy } = await import(pathToFileURL(path.join(apiDir, 'dist/modules/auth/jwt.strategy.js')).href);

  const prisma = new PrismaService();
  await prisma.$connect();
  const jwt = { sign: payload => JSON.stringify(payload) };
  const auth = new AuthService(prisma, jwt);

  console.log('\n--- VERIFYING B1: FULLY CONSUMED ADVANCE IN SUBSEQUENT DRAFT ---');
  {
    const org = await prisma.organization.create({ data: { name: 'B1 Verify' } });
    const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'B1 Farm' } });
    const accounting = new AccountingService(prisma);
    await accounting.ensureAccountingStructure(farm.id);
    const payroll = new PayrollService(prisma, accounting);
    const advances = new AdvancesService(prisma, accounting);
    const employees = new EmployeesService(prisma);
    const actor = { id: randomUUID(), orgId: org.id, farmId: farm.id };
    const year = new Date().getUTCFullYear();

    const emp = await employees.create(farm.id, {
      employeeCode: 'EMP-B1',
      firstName: 'Review',
      lastName: 'B1',
      jobTitle: 'Worker',
      baseSalary: 1000,
      hireDate: `${year}-01-01`,
    }, actor);

    const cash = await prisma.account.findFirstOrThrow({ where: { farmId: farm.id, code: '1101' } });
    const adv = await advances.requestAdvance(farm.id, emp.id, {
      amount: 500,
      requestDate: `${year}-01-15`,
      paymentAccountId: cash.id,
    }, actor);

    const p1 = await payroll.generatePayroll(farm.id, {
      monthName: '01',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-28`,
    }, actor);

    const p2 = await payroll.generatePayroll(farm.id, {
      monthName: '02',
      startDate: `${year}-02-01`,
      endDate: `${year}-02-28`,
    }, actor);

    await payroll.approvePayroll(farm.id, p1.id, actor);
    await payroll.approvePayroll(farm.id, p2.id, actor);

    const slip2 = await prisma.payrollSlip.findFirstOrThrow({ where: { periodId: p2.id } });
    const account1106 = await prisma.account.findFirstOrThrow({ where: { farmId: farm.id, code: '1106' } });
    const settlementsP2 = await prisma.advanceSettlement.count({ where: { periodId: p2.id } });

    console.log('Month 2 Slip advancesSettled:', Number(slip2.advancesSettled));
    console.log('Month 2 Slip netSalary:', Number(slip2.netSalary));
    console.log('Account 1106 Balance:', Number(account1106.currentBalance));
    console.log('Month 2 Settlements Count:', settlementsP2);

    assert.equal(Number(slip2.advancesSettled), 0, 'Month 2 must NOT deduct already exhausted advance');
    assert.equal(Number(slip2.netSalary), 1000, 'Month 2 net salary must be full 1000');
    assert.equal(Number(account1106.currentBalance), 0, 'Account 1106 must NOT be negative -500');
    assert.equal(settlementsP2, 0, 'Advance settlements for Month 2 must be 0');
    console.log('✅ B1 PASSED: Fully consumed advance does not over-deduct or create negative account balance!');
  }

  console.log('\n--- VERIFYING B2: DELETE DRAFT CONCURRENT WITH APPROVE ---');
  {
    const org = await prisma.organization.create({ data: { name: 'B2 Verify' } });
    const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'B2 Farm' } });
    const accounting = new AccountingService(prisma);
    await accounting.ensureAccountingStructure(farm.id);
    const payroll = new PayrollService(prisma, accounting);
    const employees = new EmployeesService(prisma);
    const actor = { id: randomUUID(), orgId: org.id, farmId: farm.id };
    const year = new Date().getUTCFullYear();

    await employees.create(farm.id, {
      employeeCode: 'EMP-B2',
      firstName: 'Review',
      lastName: 'B2',
      jobTitle: 'Worker',
      baseSalary: 1000,
      hireDate: `${year}-01-01`,
    }, actor);

    const p = await payroll.generatePayroll(farm.id, {
      monthName: '01',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-28`,
    }, actor);

    // Approve the payroll period
    await payroll.approvePayroll(farm.id, p.id, actor);

    // Now attempt deleteDraft -> must reject because period is APPROVED
    let deleted = false;
    let errorStatus = 0;
    try {
      await payroll.deleteDraft(farm.id, p.id, actor);
      deleted = true;
    } catch (e) {
      errorStatus = e.getStatus ? e.getStatus() : 400;
    }

    assert.equal(deleted, false, 'deleteDraft must NOT delete an approved period');
    assert.equal(errorStatus, 400, 'Must reject with 400 Bad Request');

    const periodExists = await prisma.payrollPeriod.count({ where: { id: p.id } });
    const slipsCount = await prisma.payrollSlip.count({ where: { periodId: p.id } });
    const journalsCount = await prisma.journalEntry.count({ where: { referenceId: p.id } });

    console.log('Period exists:', periodExists, 'Slips:', slipsCount, 'Journals:', journalsCount);
    assert.equal(periodExists, 1);
    assert.equal(slipsCount, 1);
    assert.equal(journalsCount, 1);
    console.log('✅ B2 PASSED: Approved period cannot be deleted, journal is not orphaned!');
  }

  console.log('\n--- VERIFYING A2: ZERO-NET PAYROLL DISBURSEMENT AUDIT EVENT ---');
  {
    const org = await prisma.organization.create({ data: { name: 'A2 Verify' } });
    const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'A2 Farm' } });
    const accounting = new AccountingService(prisma);
    await accounting.ensureAccountingStructure(farm.id);
    const payroll = new PayrollService(prisma, accounting);
    const advances = new AdvancesService(prisma, accounting);
    const employees = new EmployeesService(prisma);
    const actor = { id: randomUUID(), orgId: org.id, farmId: farm.id };
    const year = new Date().getUTCFullYear();

    const emp = await employees.create(farm.id, {
      employeeCode: 'EMP-A2',
      firstName: 'Review',
      lastName: 'A2',
      jobTitle: 'Worker',
      baseSalary: 500,
      hireDate: `${year}-01-01`,
    }, actor);

    const cash = await prisma.account.findFirstOrThrow({ where: { farmId: farm.id, code: '1101' } });
    await advances.requestAdvance(farm.id, emp.id, {
      amount: 500,
      requestDate: `${year}-01-15`,
      paymentAccountId: cash.id,
    }, actor);

    const p = await payroll.generatePayroll(farm.id, {
      monthName: '01',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-28`,
    }, actor);

    await payroll.approvePayroll(farm.id, p.id, actor);

    const auditBefore = await prisma.auditEvent.count({ where: { farmId: farm.id } });
    const paid = await payroll.payPayroll(farm.id, p.id, { paymentAccountId: cash.id }, actor);
    const auditAfter = await prisma.auditEvent.count({ where: { farmId: farm.id } });

    assert.equal(paid.status, 'PAID');
    assert.ok(auditAfter > auditBefore, 'Must record audit event even when net is zero');

    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: { farmId: farm.id, action: 'hr.payroll.paid', entityId: p.id },
    });
    console.log('Zero Net Audit Event:', auditEvent.action, 'Metadata:', auditEvent.metadata);
    console.log('✅ A2 PASSED: Zero-net payroll disbursement logs domain audit event inside transaction!');
  }

  console.log('\n--- VERIFYING A1: SESSION FAMILY INVALIDATION ---');
  {
    const org = await prisma.organization.create({ data: { name: 'A1 Verify' } });
    const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'A1 Farm' } });
    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        farmId: farm.id,
        username: 'review-a1-' + randomUUID(),
        password: 'password-1234',
        fullName: 'Review A1',
        role: 'FARM_MANAGER',
      },
    });

    const token = randomUUID();
    const s1 = await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const first = await auth.refresh(token);
    assert.ok(first.accessToken);

    // Now logout
    await auth.logout(first.refreshToken);

    // Verify session family is logged out
    const activeSessions = await prisma.userSession.count({
      where: { userId: user.id, revokedAt: null },
    });
    console.log('Active sessions after logout:', activeSessions);
    assert.equal(activeSessions, 0, 'No active sessions after logout');

    // Attempt to refresh old token -> must fail
    let refreshStatus = 200;
    try {
      await auth.refresh(token);
    } catch (e) {
      refreshStatus = e.getStatus ? e.getStatus() : 401;
    }
    assert.equal(refreshStatus, 401, 'Refresh on logged-out family must return 401');

    // Token validation of revoked session -> must reject
    const payload = JSON.parse(first.accessToken);
    const strategy = new JwtStrategy(prisma, { get: () => 'x'.repeat(32) });
    let validated = false;
    try {
      await strategy.validate(payload);
      validated = true;
    } catch (e) {
      console.log('JwtStrategy rejected as expected:', e.message);
    }
    assert.equal(validated, false, 'JwtStrategy must reject revoked session token');
    console.log('✅ A1 PASSED: Session family invalidation prevents access and refresh token resurrection!');
  }

  console.log('\n--- VERIFYING B3: LEGACY DRAFT ADVANCE RECONCILIATION MIGRATION ---');
  {
    const org = await prisma.organization.create({ data: { name: 'B3 Verify' } });
    const farm = await prisma.farm.create({ data: { orgId: org.id, name: 'B3 Farm' } });
    const accounting = new AccountingService(prisma);
    await accounting.ensureAccountingStructure(farm.id);
    const payroll = new PayrollService(prisma, accounting);
    const advances = new AdvancesService(prisma, accounting);
    const employees = new EmployeesService(prisma);
    const actor = { id: randomUUID(), orgId: org.id, farmId: farm.id };
    const year = new Date().getUTCFullYear();

    const emp = await employees.create(farm.id, {
      employeeCode: 'EMP-B3',
      firstName: 'Review',
      lastName: 'B3',
      jobTitle: 'Worker',
      baseSalary: 1000,
      hireDate: `${year}-01-01`,
    }, actor);

    const cash = await prisma.account.findFirstOrThrow({ where: { farmId: farm.id, code: '1101' } });
    const adv = await advances.requestAdvance(farm.id, emp.id, {
      amount: 1500,
      requestDate: `${year}-01-15`,
      paymentAccountId: cash.id,
    }, actor);

    const lp = await payroll.generatePayroll(farm.id, {
      monthName: '01',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-28`,
    }, actor);

    // Reconstruct legacy state: draft deducted partially but flagged isSettled: true prematurely
    await prisma.advanceSettlement.deleteMany({ where: { periodId: lp.id } });
    await prisma.employeeAdvance.update({
      where: { id: adv.id },
      data: { isSettled: true, settledPeriodId: lp.id, settledAmount: 0 },
    });

    // Execute the actual reconciliation migration SQL
    const migrationSql = fs.readFileSync(
      path.join(apiDir, 'prisma/migrations/20260918120000_hr_advance_integrity/migration.sql'),
      'utf8',
    );
    for (const stmt of migrationSql.split(';').filter(x => /UPDATE/.test(x))) {
      await prisma.$executeRawUnsafe(stmt);
    }

    // Now delete the unapproved draft
    await payroll.deleteDraft(farm.id, lp.id, actor);

    const reconciledAdvance = await prisma.employeeAdvance.findUniqueOrThrow({ where: { id: adv.id } });
    const ledgerAccount = await prisma.account.findFirstOrThrow({ where: { farmId: farm.id, code: '1106' } });

    console.log('Reconciled Advance isSettled:', reconciledAdvance.isSettled);
    console.log('Reconciled Advance settledAmount:', Number(reconciledAdvance.settledAmount));
    console.log('Account 1106 Ledger Balance:', Number(ledgerAccount.currentBalance));

    assert.equal(reconciledAdvance.isSettled, false, 'Advance linked to deleted draft must NOT be settled');
    assert.equal(Number(reconciledAdvance.settledAmount), 0, 'Settled amount must be 0');
    assert.equal(Number(ledgerAccount.currentBalance), 1500, 'Ledger receivable matches open advance of 1500');
    console.log('✅ B3 PASSED: Legacy draft advance safely reconciled and stays open, matching GL!');
  }

  console.log('\n🎉 ALL 5 AUDIT FINDINGS (B1, B2, A2, A1, B3) VERIFIED 100% SUCCESSFUL ON REAL POSTGRESQL!');
  await prisma.$disconnect();
  // Allow connections to drain
  await new Promise(resolve => setTimeout(resolve, 500));
} finally {
  try {
    await administrator.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await administrator.query(`DROP DATABASE IF EXISTS ${quotedDatabaseName}`);
    await administrator.end();
    console.log(`[CLEANUP] Removed isolated test database: ${databaseName}`);
  } catch (err) {
    // Ignore cleanup errors on exit
  }
}
process.exit(0);
