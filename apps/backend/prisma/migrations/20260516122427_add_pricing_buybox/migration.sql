-- CreateEnum
CREATE TYPE "PricingStrategy" AS ENUM ('MATCH_BUYBOX', 'BEAT_BUYBOX', 'FIXED_MARGIN', 'DYNAMIC');

-- AlterTable
ALTER TABLE "Listing" ALTER COLUMN "barcode" DROP DEFAULT,
ALTER COLUMN "imageUrls" DROP DEFAULT,
ALTER COLUMN "listPrice" DROP DEFAULT,
ALTER COLUMN "platform" DROP DEFAULT,
ALTER COLUMN "platformProductId" DROP DEFAULT,
ALTER COLUMN "salePrice" DROP DEFAULT,
ALTER COLUMN "title" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "imageUrls" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Marketplace" NOT NULL,
    "strategy" "PricingStrategy" NOT NULL,
    "minMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "maxDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "targetPosition" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applyToAll" BOOLEAN NOT NULL DEFAULT false,
    "barcodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "platform" "Marketplace" NOT NULL,
    "pricingRuleId" TEXT,
    "oldPrice" DECIMAL(10,2) NOT NULL,
    "newPrice" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyBoxSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "platform" "Marketplace" NOT NULL,
    "buyBoxPrice" DECIMAL(10,2) NOT NULL,
    "ourPrice" DECIMAL(10,2) NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "competitorCount" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyBoxSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingRule_organizationId_idx" ON "PricingRule"("organizationId");

-- CreateIndex
CREATE INDEX "PricingRule_organizationId_platform_idx" ON "PricingRule"("organizationId", "platform");

-- CreateIndex
CREATE INDEX "PriceHistory_organizationId_barcode_idx" ON "PriceHistory"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "PriceHistory_organizationId_platform_idx" ON "PriceHistory"("organizationId", "platform");

-- CreateIndex
CREATE INDEX "BuyBoxSnapshot_organizationId_barcode_platform_idx" ON "BuyBoxSnapshot"("organizationId", "barcode", "platform");

-- CreateIndex
CREATE INDEX "BuyBoxSnapshot_organizationId_platform_capturedAt_idx" ON "BuyBoxSnapshot"("organizationId", "platform", "capturedAt");

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyBoxSnapshot" ADD CONSTRAINT "BuyBoxSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
