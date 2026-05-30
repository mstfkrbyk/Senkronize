-- CreateEnum
CREATE TYPE "ProductMatchKey" AS ENUM ('BARCODE', 'SKU', 'MANUAL');

-- AlterTable
ALTER TABLE "MarketplaceConnection" ADD COLUMN "productMatchKey" "ProductMatchKey";

-- AlterTable
ALTER TABLE "ErpConnection" ADD COLUMN "productMatchKey" "ProductMatchKey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productMatchKey" "ProductMatchKey";
