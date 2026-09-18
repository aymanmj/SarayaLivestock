-- DropForeignKey
ALTER TABLE "hr_employee_advances" DROP CONSTRAINT "hr_employee_advances_employeeId_fkey";

-- AlterTable
ALTER TABLE "hr_employee_advances" ADD COLUMN     "settledAmount" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "hr_employees" ADD COLUMN     "terminationDate" DATE,
ADD COLUMN     "terminationReason" TEXT;

-- CreateTable
CREATE TABLE "hr_advance_settlements" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_advance_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_advance_settlements_advanceId_periodId_key" ON "hr_advance_settlements"("advanceId", "periodId");

-- AddForeignKey
ALTER TABLE "hr_employee_advances" ADD CONSTRAINT "hr_employee_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_advance_settlements" ADD CONSTRAINT "hr_advance_settlements_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "hr_employee_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_advance_settlements" ADD CONSTRAINT "hr_advance_settlements_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "hr_payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
