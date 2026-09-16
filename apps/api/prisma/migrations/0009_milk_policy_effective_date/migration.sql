-- Existing farms retain their recorded policy and history until explicitly changed.
ALTER TABLE "farms" ADD COLUMN "milkPolicyEffectiveDate" DATE;
