-- CreateIndex
CREATE INDEX "Order_organizationId_status_createdAt_idx" ON "Order"("organizationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_organizationId_platform_status_idx" ON "Order"("organizationId", "platform", "status");

-- CreateIndex
CREATE INDEX "Listing_barcode_organizationId_deletedAt_idx" ON "Listing"("barcode", "organizationId", "deletedAt");
