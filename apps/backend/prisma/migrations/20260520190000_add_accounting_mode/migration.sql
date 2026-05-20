-- CreateEnum
CREATE TYPE "AccountingMode" AS ENUM ('NATIVE', 'EXTERNAL_ERP');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "accountingMode" "AccountingMode";
