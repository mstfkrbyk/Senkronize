-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "couponCode" TEXT,
ADD COLUMN "stackable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "totalDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_couponCode_key" ON "Campaign"("couponCode");
