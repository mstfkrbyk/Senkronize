-- Zamanlama ve kategori/marka/SKU filtreleri
ALTER TABLE "PricingRule" ADD COLUMN "scheduledStart" TIMESTAMP(3),
ADD COLUMN "scheduledEnd" TIMESTAMP(3),
ADD COLUMN "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "hoursStart" INTEGER,
ADD COLUMN "hoursEnd" INTEGER,
ADD COLUMN "categoryFilter" TEXT,
ADD COLUMN "brandFilter" TEXT,
ADD COLUMN "skuPattern" TEXT;

-- Rakip satıcı fiyat kayıtları
CREATE TABLE "CompetitorPrice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "platform" "Marketplace" NOT NULL,
    "competitorId" TEXT NOT NULL,
    "competitorName" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "isBuyBox" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitorPrice_organizationId_barcode_platform_capturedAt_idx" ON "CompetitorPrice"("organizationId", "barcode", "platform", "capturedAt");

ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
