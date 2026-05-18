-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM (
  'SALE',
  'RETURN',
  'PURCHASE',
  'ADJUSTMENT',
  'TRANSFER',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'SYNC'
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "warehouseId" TEXT,
    "platform" TEXT,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "beforeQuantity" INTEGER NOT NULL,
    "afterQuantity" INTEGER NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable for backfill)
ALTER TABLE "StockEntry" ADD COLUMN "warehouseId" TEXT;

-- Varsayılan "MAIN" deposu (her organizasyon için bir kez)
INSERT INTO "Warehouse" ("id", "organizationId", "name", "code", "address", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'wh_main_' || o."id",
  o."id",
  'Ana Depo',
  'MAIN',
  NULL,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Warehouse" w WHERE w."organizationId" = o."id" AND w."code" = 'MAIN'
);

UPDATE "StockEntry" se
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE w."organizationId" = se."organizationId" AND w."code" = 'MAIN';

ALTER TABLE "StockEntry" ALTER COLUMN "warehouseId" SET NOT NULL;

-- Drop old unique constraint / index
DROP INDEX IF EXISTS "StockEntry_organizationId_barcode_platform_key";

-- CreateIndex / FK
CREATE UNIQUE INDEX "StockEntry_organizationId_barcode_platform_warehouseId_key" ON "StockEntry"("organizationId", "barcode", "platform", "warehouseId");

CREATE INDEX "StockEntry_warehouseId_idx" ON "StockEntry"("warehouseId");

CREATE UNIQUE INDEX "Warehouse_organizationId_code_key" ON "Warehouse"("organizationId", "code");

CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

CREATE INDEX "StockMovement_organizationId_barcode_createdAt_idx" ON "StockMovement"("organizationId", "barcode", "createdAt");

CREATE INDEX "StockMovement_organizationId_movementType_createdAt_idx" ON "StockMovement"("organizationId", "movementType", "createdAt");

ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
