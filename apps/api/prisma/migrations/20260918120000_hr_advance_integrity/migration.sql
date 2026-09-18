-- Reconcile historical advances where isSettled = true but settledAmount was left at 0
UPDATE "hr_employee_advances"
SET "settledAmount" = "amount"
WHERE "isSettled" = true AND "settledAmount" = 0;

-- Guardrail: ensure no historical row violates the invariant before applying constraint
UPDATE "hr_employee_advances"
SET "settledAmount" = "amount"
WHERE "settledAmount" > "amount";

UPDATE "hr_employee_advances"
SET "settledAmount" = 0
WHERE "settledAmount" < 0;

-- Enforce database-level CHECK constraints for financial integrity
ALTER TABLE "hr_employee_advances"
ADD CONSTRAINT "chk_advance_settled_lte_amount" CHECK ("settledAmount" <= "amount");

ALTER TABLE "hr_employee_advances"
ADD CONSTRAINT "chk_advance_settled_gte_zero" CHECK ("settledAmount" >= 0);
