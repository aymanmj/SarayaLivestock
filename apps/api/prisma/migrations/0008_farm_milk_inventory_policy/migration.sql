-- CreateEnum
CREATE TYPE "MilkInventoryPolicy" AS ENUM ('DAILY_RESET', 'CARRY_OVER');

-- AlterTable
ALTER TABLE "farms" ADD COLUMN "milkPolicy" "MilkInventoryPolicy" NOT NULL DEFAULT 'DAILY_RESET';
