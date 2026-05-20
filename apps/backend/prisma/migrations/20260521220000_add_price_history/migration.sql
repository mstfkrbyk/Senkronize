-- AlterTable: PriceHistory — listingId, source, genişletilmiş ondalık
ALTER TABLE "PriceHistory" ADD COLUMN "listingId" TEXT;
ALTER TABLE "PriceHistory" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- Mevcut reason değerlerinden source türet
UPDATE "PriceHistory"
SET "source" = CASE
  WHEN "reason" = 'manual' THEN 'manual'
  WHEN "reason" LIKE 'campaign:%' THEN 'campaign'
  WHEN "pricingRuleId" IS NOT NULL THEN 'rule'
  ELSE 'manual'
END;

-- CreateTable: PriceAlert
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "thresholdPrice" DECIMAL(12,2) NOT NULL,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceHistory_listingId_appliedAt_idx" ON "PriceHistory"("listingId", "appliedAt");

CREATE INDEX "PriceAlert_organizationId_idx" ON "PriceAlert"("organizationId");

CREATE INDEX "PriceAlert_organizationId_listingId_idx" ON "PriceAlert"("organizationId", "listingId");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
