-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- AlterTable
ALTER TABLE "bulk_tank_logs" ALTER COLUMN "tankTemperature" SET DATA TYPE DECIMAL(6,3),
ALTER COLUMN "fatPctAvg" SET DATA TYPE DECIMAL(6,3),
ALTER COLUMN "proteinPctAvg" SET DATA TYPE DECIMAL(6,3);

-- AlterTable
ALTER TABLE "feed_formula_items" ALTER COLUMN "percentage" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "feed_ingredients" ALTER COLUMN "dryMatterPct" SET DATA TYPE DECIMAL(6,3),
ALTER COLUMN "proteinPct" SET DATA TYPE DECIMAL(6,3),
ALTER COLUMN "energyMcal" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "milk_logs" ALTER COLUMN "fatPct" SET DATA TYPE DECIMAL(6,3),
ALTER COLUMN "proteinPct" SET DATA TYPE DECIMAL(6,3);

-- CreateTable
CREATE TABLE "hr_employees" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "hireDate" DATE NOT NULL,
    "baseSalary" DECIMAL(12,3) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "bankAccount" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_periods" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "monthName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_slips" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(12,3) NOT NULL,
    "bonuses" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "advancesSettled" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "hr_payroll_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_advances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestDate" DATE NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "reason" TEXT,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledPeriodId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_employee_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_userId_key" ON "hr_employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_farmId_employeeCode_key" ON "hr_employees"("farmId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_periods_farmId_fiscalPeriodId_key" ON "hr_payroll_periods"("farmId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_slips_periodId_employeeId_key" ON "hr_payroll_slips"("periodId", "employeeId");

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_periods" ADD CONSTRAINT "hr_payroll_periods_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_periods" ADD CONSTRAINT "hr_payroll_periods_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_periods" ADD CONSTRAINT "hr_payroll_periods_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_slips" ADD CONSTRAINT "hr_payroll_slips_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "hr_payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_slips" ADD CONSTRAINT "hr_payroll_slips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_advances" ADD CONSTRAINT "hr_employee_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_advances" ADD CONSTRAINT "hr_employee_advances_settledPeriodId_fkey" FOREIGN KEY ("settledPeriodId") REFERENCES "hr_payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_advances" ADD CONSTRAINT "hr_employee_advances_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
