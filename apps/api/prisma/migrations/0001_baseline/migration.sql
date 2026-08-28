-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('STANDARD', 'ENTERPRISE', 'ON_PREMISE');

-- CreateEnum
CREATE TYPE "SectorType" AS ENUM ('DAIRY', 'FATTENING', 'BREEDING', 'CALVES', 'ISOLATION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'FARM_MANAGER', 'VETERINARIAN', 'MILKER', 'ACCOUNTANT', 'WORKER');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('CATTLE', 'SHEEP', 'GOAT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('DAIRY', 'BEEF', 'DUAL', 'BREEDING');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'CULLED', 'DECEASED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "LifeStage" AS ENUM ('CALF', 'WEANED', 'HEIFER', 'PREGNANT_HEIFER', 'LACTATING', 'DRY', 'FATTENING', 'SIRE');

-- CreateEnum
CREATE TYPE "MilkingShift" AS ENUM ('MORNING', 'NOON', 'EVENING');

-- CreateEnum
CREATE TYPE "InseminationType" AS ENUM ('ARTIFICIAL', 'NATURAL');

-- CreateEnum
CREATE TYPE "PregnancyResult" AS ENUM ('PENDING', 'PREGNANT', 'OPEN');

-- CreateEnum
CREATE TYPE "CalvingDifficulty" AS ENUM ('EASY', 'ASSISTED', 'SURGICAL', 'ABORTION');

-- CreateEnum
CREATE TYPE "CostCenterType" AS ENUM ('DAIRY_PRODUCTION', 'FATTENING_PRODUCTION', 'BREEDING_REPLACEMENT', 'GENERAL_OVERHEAD');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FiscalStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('MANUAL', 'FEED_DISPENSE', 'MILK_SALE', 'CATTLE_SALE', 'CALVING_CAPITALIZE', 'MORTALITY_LOSS', 'OPENING_BALANCE', 'YEAR_END_CLOSING');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT,
    "phone" TEXT,
    "planType" "PlanType" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "managerName" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barns" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectorType" "SectorType" NOT NULL DEFAULT 'DAIRY',
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "farmId" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'WORKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "farmId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "httpMethod" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "barnId" TEXT,
    "tagNumber" TEXT NOT NULL,
    "rfidTag" TEXT,
    "name" TEXT,
    "species" "Species" NOT NULL DEFAULT 'CATTLE',
    "breed" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'FEMALE',
    "purpose" "Purpose" NOT NULL DEFAULT 'DAIRY',
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentLifeStage" "LifeStage" NOT NULL DEFAULT 'CALF',
    "birthDate" TIMESTAMP(3),
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryWeightKg" DECIMAL(10,3),
    "purchasePrice" DECIMAL(15,3),
    "motherId" TEXT,
    "fatherSemenCode" TEXT,
    "withdrawalEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_logs" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "shift" "MilkingShift" NOT NULL DEFAULT 'MORNING',
    "yieldLiters" DECIMAL(10,3) NOT NULL,
    "fatPct" DECIMAL(5,2),
    "proteinPct" DECIMAL(5,2),
    "isDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "discardReason" TEXT,
    "loggedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milk_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_tank_logs" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "totalYieldLiters" DECIMAL(12,3) NOT NULL,
    "soldLiters" DECIMAL(12,3) NOT NULL,
    "calfFeedingLiters" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "wastedLiters" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "tankTemperature" DECIMAL(5,2),
    "fatPctAvg" DECIMAL(5,2),
    "proteinPctAvg" DECIMAL(5,2),
    "unitPrice" DECIMAL(10,3),
    "buyerName" TEXT,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_tank_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "weighDate" DATE NOT NULL,
    "weightKg" DECIMAL(10,3) NOT NULL,
    "dailyGainAdg" DECIMAL(10,3),
    "daysSinceLast" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeding_records" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "inseminationDate" DATE NOT NULL,
    "inseminationType" "InseminationType" NOT NULL DEFAULT 'ARTIFICIAL',
    "semenCode" TEXT,
    "inseminatorName" TEXT,
    "pdCheckDate" DATE,
    "pdResult" "PregnancyResult" NOT NULL DEFAULT 'PENDING',
    "expectedCalvingDate" DATE,
    "expectedDryoffDate" DATE,
    "actualCalvingDate" DATE,
    "calvingDifficulty" "CalvingDifficulty",
    "offspringCount" INTEGER NOT NULL DEFAULT 1,
    "offspringGender" "Gender",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breeding_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_treatments" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "treatmentDate" DATE NOT NULL,
    "milkWithdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "meatWithdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "withdrawalEndDate" TIMESTAMP(3),
    "vetName" TEXT,
    "treatmentCost" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_ingredients" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "currentStock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "minStockAlert" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "costPerUnit" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "dryMatterPct" DECIMAL(5,2),
    "proteinPct" DECIMAL(5,2),
    "energyMcal" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formulas" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetSector" "SectorType" NOT NULL DEFAULT 'DAIRY',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formula_items" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "percentage" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "feed_formula_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_distributions" (
    "id" TEXT NOT NULL,
    "barnId" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "dispenseDate" DATE NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(15,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CostCenterType" NOT NULL DEFAULT 'DAIRY_PRODUCTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "transDate" DATE NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(15,3) NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "yearName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "FiscalStatus" NOT NULL DEFAULT 'OPEN',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "periodName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "FiscalStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "category" "AccountCategory" NOT NULL,
    "parentId" TEXT,
    "currentBalance" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystemLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "type" "JournalEntryType" NOT NULL DEFAULT 'MANUAL',
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "totalDebit" DECIMAL(18,3) NOT NULL,
    "totalCredit" DECIMAL(18,3) NOT NULL,
    "postedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "debit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_sequences" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barns_farmId_name_key" ON "barns"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "audit_events_orgId_createdAt_idx" ON "audit_events"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_farmId_createdAt_idx" ON "audit_events"("farmId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "animals_farmId_status_idx" ON "animals"("farmId", "status");

-- CreateIndex
CREATE INDEX "animals_farmId_rfidTag_idx" ON "animals"("farmId", "rfidTag");

-- CreateIndex
CREATE UNIQUE INDEX "animals_farmId_tagNumber_key" ON "animals"("farmId", "tagNumber");

-- CreateIndex
CREATE INDEX "milk_logs_animalId_logDate_idx" ON "milk_logs"("animalId", "logDate");

-- CreateIndex
CREATE UNIQUE INDEX "milk_logs_animalId_logDate_shift_key" ON "milk_logs"("animalId", "logDate", "shift");

-- CreateIndex
CREATE INDEX "weight_logs_animalId_weighDate_idx" ON "weight_logs"("animalId", "weighDate");

-- CreateIndex
CREATE UNIQUE INDEX "weight_logs_animalId_weighDate_key" ON "weight_logs"("animalId", "weighDate");

-- CreateIndex
CREATE INDEX "breeding_records_animalId_inseminationDate_idx" ON "breeding_records"("animalId", "inseminationDate");

-- CreateIndex
CREATE INDEX "health_treatments_animalId_treatmentDate_idx" ON "health_treatments"("animalId", "treatmentDate");

-- CreateIndex
CREATE UNIQUE INDEX "feed_ingredients_farmId_name_key" ON "feed_ingredients"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "feed_formulas_farmId_name_key" ON "feed_formulas"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "feed_formula_items_formulaId_ingredientId_key" ON "feed_formula_items"("formulaId", "ingredientId");

-- CreateIndex
CREATE INDEX "feed_distributions_barnId_dispenseDate_idx" ON "feed_distributions"("barnId", "dispenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_farmId_yearName_key" ON "fiscal_years"("farmId", "yearName");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_fiscalYearId_periodNumber_key" ON "fiscal_periods"("fiscalYearId", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_farmId_code_key" ON "accounts"("farmId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_farmId_entryNumber_key" ON "journal_entries"("farmId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "journal_sequences_farmId_fiscalYearId_key" ON "journal_sequences"("farmId", "fiscalYearId");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barns" ADD CONSTRAINT "barns_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "barns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_logs" ADD CONSTRAINT "milk_logs_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_tank_logs" ADD CONSTRAINT "bulk_tank_logs_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_treatments" ADD CONSTRAINT "health_treatments_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_ingredients" ADD CONSTRAINT "feed_ingredients_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulas" ADD CONSTRAINT "feed_formulas_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formula_items" ADD CONSTRAINT "feed_formula_items_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "feed_formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formula_items" ADD CONSTRAINT "feed_formula_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "feed_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "barns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "feed_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
