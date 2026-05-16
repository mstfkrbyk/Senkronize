-- AlterTable
ALTER TABLE "MarketplaceConnection" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorMessage" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceConnection_organizationId_idx" ON "MarketplaceConnection"("organizationId");
