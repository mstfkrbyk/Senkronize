-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "address" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "taxNumber" TEXT,
ADD COLUMN "taxOffice" TEXT,
ADD COLUMN "website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxNumber_key" ON "Organization"("taxNumber");
