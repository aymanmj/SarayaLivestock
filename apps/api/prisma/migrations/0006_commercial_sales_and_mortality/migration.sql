-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('MILK', 'LIVE_ANIMAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'ON_ACCOUNT');

-- CreateEnum
CREATE TYPE "AnimalPricingMethod" AS ENUM ('BY_WEIGHT', 'PER_HEAD');

-- CreateTable
CREATE TABLE "commercial_sales" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleType" "SaleType" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "notes" TEXT,
    "liters" DECIMAL(12,3),
    "pricePerLiter" DECIMAL(10,3),
    "animalId" TEXT,
    "pricingMethod" "AnimalPricingMethod",
    "weightKg" DECIMAL(10,3),
    "pricePerKg" DECIMAL(10,3),
    "pricePerHead" DECIMAL(15,3),
    "totalAmount" DECIMAL(18,3) NOT NULL,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_mortalities" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "deathDate" DATE NOT NULL,
    "causeOfDeath" TEXT NOT NULL,
    "salvageValue" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "bookValue" DECIMAL(15,3) NOT NULL,
    "netLoss" DECIMAL(15,3) NOT NULL,
    "notes" TEXT,
    "journalEntryId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_mortalities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_sales_farmId_invoiceNumber_key" ON "commercial_sales"("farmId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "commercial_sales_farmId_saleDate_idx" ON "commercial_sales"("farmId", "saleDate");

-- CreateIndex
CREATE INDEX "commercial_sales_farmId_saleType_idx" ON "commercial_sales"("farmId", "saleType");

-- CreateIndex
CREATE INDEX "animal_mortalities_farmId_deathDate_idx" ON "animal_mortalities"("farmId", "deathDate");

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_mortalities" ADD CONSTRAINT "animal_mortalities_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_mortalities" ADD CONSTRAINT "animal_mortalities_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_mortalities" ADD CONSTRAINT "animal_mortalities_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
