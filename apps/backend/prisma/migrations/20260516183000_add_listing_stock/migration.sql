-- Listeleme şeması genişlemesi: mevcut satırlar için güvenli dönüşüm
DELETE FROM "Listing";

ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_productId_fkey";
DROP INDEX IF EXISTS "Listing_organizationId_marketplace_productId_key";

ALTER TABLE "Listing" DROP COLUMN IF EXISTS "externalId";
ALTER TABLE "Listing" DROP COLUMN IF EXISTS "marketplace";

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
UPDATE "Product" SET "barcode" = COALESCE(NULLIF(TRIM("sku"), ''), "id") WHERE "barcode" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "barcode" SET NOT NULL;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "barcode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "listPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "platform" "Marketplace" NOT NULL DEFAULT 'TRENDYOL'::"Marketplace";
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "platformProductId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "salePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Listing" ALTER COLUMN "productId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "StockEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "barcode" TEXT NOT NULL,
    "platform" "Marketplace",
    "quantity" INTEGER NOT NULL,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockEntry_organizationId_idx" ON "StockEntry"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "StockEntry_organizationId_barcode_platform_key" ON "StockEntry"("organizationId", "barcode", "platform");

CREATE INDEX IF NOT EXISTS "Listing_organizationId_idx" ON "Listing"("organizationId");

CREATE INDEX IF NOT EXISTS "Listing_organizationId_platform_idx" ON "Listing"("organizationId", "platform");

CREATE UNIQUE INDEX IF NOT EXISTS "Listing_organizationId_platform_platformProductId_key" ON "Listing"("organizationId", "platform", "platformProductId");

CREATE INDEX IF NOT EXISTS "Product_organizationId_idx" ON "Product"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
