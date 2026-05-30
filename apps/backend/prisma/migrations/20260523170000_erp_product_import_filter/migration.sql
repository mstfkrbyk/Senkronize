-- CreateEnum
CREATE TYPE "ErpProductImportMode" AS ENUM ('ECOMMERCE_ONLY', 'CATEGORY', 'ALL');

-- AlterTable
ALTER TABLE "ErpSyncSettings"
ADD COLUMN "productImportMode" "ErpProductImportMode" NOT NULL DEFAULT 'ECOMMERCE_ONLY',
ADD COLUMN "erpCategoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
