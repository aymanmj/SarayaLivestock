-- 1. Reset advances linked to DRAFT periods or orphaned unapproved advances that had isSettled prematurely set to true
UPDATE "hr_employee_advances"
SET "isSettled" = false,
    "settledAmount" = 0,
    "settledPeriodId" = NULL
WHERE ("isSettled" = true OR "settledAmount" = 0)
  AND ("settledPeriodId" IS NULL 
       OR "settledPeriodId" IN (SELECT "id" FROM "hr_payroll_periods" WHERE "status" = 'DRAFT'));

-- 2. For advances with existing advance settlements in APPROVED or PAID periods, reconcile settledAmount from surviving settlements
UPDATE "hr_employee_advances" a
SET "settledAmount" = COALESCE((
    SELECT SUM(s."amount")
    FROM "hr_advance_settlements" s
    JOIN "hr_payroll_periods" p ON s."periodId" = p."id"
    WHERE s."advanceId" = a."id"
      AND p."status" IN ('APPROVED', 'PAID')
), 0)
WHERE EXISTS (
    SELECT 1 FROM "hr_advance_settlements" s WHERE s."advanceId" = a."id"
);

-- 3. For historical legacy advances with isSettled = true linked to APPROVED or PAID periods without AdvanceSettlement rows
UPDATE "hr_employee_advances"
SET "settledAmount" = "amount"
WHERE "isSettled" = true
  AND "settledAmount" = 0
  AND "settledPeriodId" IN (SELECT "id" FROM "hr_payroll_periods" WHERE "status" IN ('APPROVED', 'PAID'));

-- 4. Sync isSettled flag with settledAmount >= amount
UPDATE "hr_employee_advances"
SET "isSettled" = ("settledAmount" >= "amount");

-- 5. Guardrail: ensure no historical row violates the invariant before applying constraints
UPDATE "hr_employee_advances"
SET "settledAmount" = "amount"
WHERE "settledAmount" > "amount";

UPDATE "hr_employee_advances"
SET "settledAmount" = 0
WHERE "settledAmount" < 0;

-- 6. Enforce database-level CHECK constraints for financial integrity
ALTER TABLE "hr_employee_advances"
ADD CONSTRAINT "chk_advance_settled_lte_amount" CHECK ("settledAmount" <= "amount");

ALTER TABLE "hr_employee_advances"
ADD CONSTRAINT "chk_advance_settled_gte_zero" CHECK ("settledAmount" >= 0);
