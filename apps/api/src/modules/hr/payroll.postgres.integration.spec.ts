import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PayrollService } from './payroll.service';
import { EmployeesService } from './employees.service';
import { AdvancesService } from './advances.service';
import { AccountingService } from '../accounting/accounting.service';
import { SystemHealthService } from '../../system/system-health.service';

const describeDatabase = (process.env.RUN_DB_INTEGRATION_TESTS === 'true' && Boolean(process.env.DATABASE_URL)) ? describe : describe.skip;
jest.setTimeout(30000);

describeDatabase('Payroll & HR Integration Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let payrollService: PayrollService;
  let employeesService: EmployeesService;
  let advancesService: AdvancesService;
  let accountingService: AccountingService;

  const farmId = 'b0b181b8-65ba-4113-91ee-e4142f1f5869'; // fixed valid UUID
  const orgId = 'org-hr-test';
  let yearId: string;
  let periodId: string;
  let employeeId: string;
  let advanceId: string;
  const mockActor = { id: 'u1', name: 'Test', role: 'ADMIN', farmId, orgId };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        PayrollService,
        EmployeesService,
        AdvancesService,
        AccountingService,
        SystemHealthService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    payrollService = app.get(PayrollService);
    employeesService = app.get(EmployeesService);
    advancesService = app.get(AdvancesService);
    accountingService = app.get(AccountingService);

    // Setup basic farm & accounting
    await prisma.organization.upsert({
      where: { id: orgId },
      update: {},
      create: { id: orgId, name: 'Org HR Test' }
    });
    await prisma.farm.upsert({ 
      where: { id: farmId }, 
      update: {}, 
      create: { id: farmId, orgId, name: 'مزرعة الرواتب' } 
    });
    const year = await prisma.fiscalYear.create({
      data: {
        farmId,
        yearName: '2026',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
        status: 'OPEN',
        isCurrent: true,
      },
    });
    yearId = year.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        fiscalYearId: yearId,
        periodNumber: 1,
        periodName: 'شهر 1',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        status: 'OPEN',
      },
    });
    periodId = period.id;

    await prisma.account.createMany({
      data: [
        { farmId, code: '1101', name: 'الخزينة', category: 'ASSET', currentBalance: 0, isActive: true },
        { farmId, code: '1106', name: 'سلف الموظفين والعمالة', category: 'ASSET', currentBalance: 0, isActive: true },
        { farmId, code: '2102', name: 'الرواتب المستحقة', category: 'LIABILITY', currentBalance: 0, isActive: true },
        { farmId, code: '5103', name: 'مصروفات الرواتب والأجور', category: 'EXPENSE', currentBalance: 0, isActive: true },
      ],
    });

    const emp = await employeesService.create(
      farmId,
      {
        employeeCode: 'EMP-001',
        firstName: 'أحمد',
        lastName: 'موظف',
        nationalId: '123456789',
        hireDate: '2026-01-01T00:00:00Z',
        baseSalary: 3000,
        jobTitle: 'عامل',
      },
      mockActor,
    );
    employeeId = emp.id;
  });

  afterAll(async () => {
    if (prisma) {
      // The ephemeral integration test database will be dropped entirely anyway.
      // We skip manual deletion to avoid triggering immutable constraints.
      await app.close();
    }
  });

  it('allows an advance to be created for an employee', async () => {
    const cashAcc = await prisma.account.findFirst({ where: { farmId, code: '1101' } });
    expect(cashAcc).toBeDefined();
    const adv = await advancesService.requestAdvance(farmId, employeeId, {
      amount: 500,
      requestDate: '2026-01-15T00:00:00Z',
      reason: 'سلفة طارئة',
      paymentAccountId: cashAcc!.id,
    }, mockActor as any);
    advanceId = adv.id;
    expect(adv.amount.toNumber()).toBe(500);
    expect(adv.isSettled).toBe(false);
  });

  it('generates a DRAFT payroll without general ledger impact', async () => {
    const periodStr = '2026-01';
    const result = await payrollService.generatePayroll(farmId, {
      monthName: periodStr,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-01-31T23:59:59Z',
    }, mockActor as any);

    expect(result.monthName).toBe(periodStr);
    expect(result.status).toBe('DRAFT');

    const slips = await prisma.payrollSlip.findMany({ where: { periodId: result.id } });
    expect(slips.length).toBe(1);
    expect(slips[0].baseSalary.toNumber()).toBe(3000);
    expect(slips[0].advancesSettled.toNumber()).toBe(500);
    expect(slips[0].netSalary.toNumber()).toBe(2500);

    // Verify NO journal entry created yet
    const journals = await prisma.journalEntry.findMany({ where: { farmId, type: 'MANUAL', referenceId: result.id } });
    expect(journals.length).toBe(0);
  });

  it('allows approving the DRAFT payroll which creates GL entries and settles advances', async () => {
    const periods = await prisma.payrollPeriod.findMany({ where: { farmId, status: 'DRAFT' } });
    expect(periods.length).toBe(1);

    const result = await payrollService.approvePayroll(farmId, periods[0].id, mockActor as any);
    expect(result.status).toBe('APPROVED');

    // Verify journal entry created
    const journals = await prisma.journalEntry.findMany({ where: { farmId, type: 'MANUAL', referenceId: result.id } });
    expect(journals.length).toBe(1);
    expect(journals[0].totalDebit.toNumber()).toBe(3000); // base salary is expense
    expect(journals[0].totalCredit.toNumber()).toBe(3000); // 2500 cash + 500 advance settled

    // Verify advance is marked settled
    const adv = await prisma.employeeAdvance.findUnique({ where: { id: advanceId } });
    expect(adv?.isSettled).toBe(true);
    expect(adv?.settledPeriodId).toBeDefined();
  });

  it('prevents duplicate concurrent payroll disbursements (F-R1)', async () => {
    const period = await prisma.payrollPeriod.findFirstOrThrow({ where: { farmId, status: 'APPROVED' } });
    const cashAcc = await prisma.account.findFirstOrThrow({ where: { farmId, code: '1101' } });

    // Attempt two simultaneous payPayroll calls
    const results = await Promise.allSettled([
      payrollService.payPayroll(farmId, period.id, { paymentAccountId: cashAcc.id }, mockActor as any),
      payrollService.payPayroll(farmId, period.id, { paymentAccountId: cashAcc.id }, mockActor as any),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one must succeed, exactly one must fail with status error
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Period must be PAID
    const updated = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: period.id } });
    expect(updated.status).toBe('PAID');

    // Exactly 1 payment journal entry (referenceId = period.id, type = MANUAL) in addition to accrual
    const journals = await prisma.journalEntry.findMany({
      where: { farmId, referenceId: period.id },
    });
    // 1 accrual journal + 1 payment journal = 2 total
    expect(journals.length).toBe(2);
  });

  it('prevents over-settlement when two drafts reference the same advance (F-R2)', async () => {
    // Find existing fiscal periods for months 2 and 3 (created by ensureAccountingStructure)
    const p2 = await prisma.fiscalPeriod.findFirstOrThrow({
      where: { fiscalYearId: yearId, periodNumber: 2 },
    });
    const p3 = await prisma.fiscalPeriod.findFirstOrThrow({
      where: { fiscalYearId: yearId, periodNumber: 3 },
    });

    // Create another employee with baseSalary 1000 and advance 1500
    const emp2 = await employeesService.create(
      farmId,
      {
        employeeCode: 'EMP-002',
        firstName: 'سالم',
        lastName: 'عامل',
        nationalId: '987654321',
        hireDate: '2026-01-01T00:00:00Z',
        baseSalary: 1000,
        jobTitle: 'عامل',
      },
      mockActor,
    );

    const cashAcc = await prisma.account.findFirstOrThrow({ where: { farmId, code: '1101' } });
    const adv2 = await advancesService.requestAdvance(farmId, emp2.id, {
      amount: 1500,
      requestDate: '2026-02-05T00:00:00Z',
      reason: 'سلفة كبيرة',
      paymentAccountId: cashAcc.id,
    }, mockActor as any);

    // Generate Month 2 draft (will deduct 1000)
    const draftMonth2 = await payrollService.generatePayroll(farmId, {
      monthName: '2026-02',
      startDate: '2026-02-01T00:00:00Z',
      endDate: '2026-02-28T23:59:59Z',
    }, mockActor as any);

    // Generate Month 3 draft before Month 2 is approved
    const draftMonth3 = await payrollService.generatePayroll(farmId, {
      monthName: '2026-03',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-31T23:59:59Z',
    }, mockActor as any);

    // Approve Month 2: settles 1000 against the 1500 advance (500 remaining)
    await payrollService.approvePayroll(farmId, draftMonth2.id, mockActor as any);
    const advAfterM2 = await prisma.employeeAdvance.findUniqueOrThrow({ where: { id: adv2.id } });
    expect(advAfterM2.settledAmount.toNumber()).toBe(1000);
    expect(advAfterM2.isSettled).toBe(false);

    // Approve Month 3: in the old bug, this added 1000 more = 2000 total settled!
    // With our F-R2 fix, it recalculates against the remaining 500 and caps at 500!
    await payrollService.approvePayroll(farmId, draftMonth3.id, mockActor as any);
    const advAfterM3 = await prisma.employeeAdvance.findUniqueOrThrow({ where: { id: adv2.id } });
    expect(advAfterM3.settledAmount.toNumber()).toBe(1500); // exactly 1500, NOT 2000!
    expect(advAfterM3.isSettled).toBe(true);

    // Account 1106 must NOT have a negative balance
    const advAccount = await prisma.account.findFirstOrThrow({ where: { farmId, code: '1106' } });
    expect(advAccount.currentBalance.toNumber()).toBeGreaterThanOrEqual(0);
  });

  it('handles zero net salary payroll disbursement without zero-amount journal error (F-R3)', async () => {
    const p4 = await prisma.fiscalPeriod.findFirstOrThrow({
      where: { fiscalYearId: yearId, periodNumber: 4 },
    });

    // Employee 3: baseSalary 500, advance 500 -> Net salary is 0
    const emp3 = await employeesService.create(
      farmId,
      {
        employeeCode: 'EMP-003',
        firstName: 'خالد',
        lastName: 'عامل',
        nationalId: '112233445',
        hireDate: '2026-01-01T00:00:00Z',
        baseSalary: 500,
        jobTitle: 'عامل',
      },
      mockActor,
    );

    // Deactivate emp1 and emp2 so only emp3 is active for month 4
    await prisma.employee.updateMany({
      where: { id: { not: emp3.id } },
      data: { status: 'TERMINATED' },
    });

    const cashAcc = await prisma.account.findFirstOrThrow({ where: { farmId, code: '1101' } });
    await advancesService.requestAdvance(farmId, emp3.id, {
      amount: 500,
      requestDate: '2026-04-05T00:00:00Z',
      reason: 'سلفة كامل الراتب',
      paymentAccountId: cashAcc.id,
    }, mockActor as any);

    const draft = await payrollService.generatePayroll(farmId, {
      monthName: '2026-04',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T23:59:59Z',
    }, mockActor as any);

    const slips = await prisma.payrollSlip.findMany({ where: { periodId: draft.id } });
    expect(slips[0].netSalary.toNumber()).toBe(0);

    // Approve the payroll
    await payrollService.approvePayroll(farmId, draft.id, mockActor as any);

    // Pay the zero-net payroll -> must NOT fail with zero-amount journal entry error!
    const paid = await payrollService.payPayroll(farmId, draft.id, { paymentAccountId: cashAcc.id }, mockActor as any);
    expect(paid.status).toBe('PAID');

    const updated = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: draft.id } });
    expect(updated.status).toBe('PAID');
  });
});
