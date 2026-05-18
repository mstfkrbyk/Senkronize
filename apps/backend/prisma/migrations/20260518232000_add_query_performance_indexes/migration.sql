-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_organizationId_createdAt_idx" ON "Product"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_barcode_organizationId_idx" ON "Listing"("barcode", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_organizationId_createdAt_idx" ON "Order"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_platformOrderId_organizationId_idx" ON "Order"("platformOrderId", "organizationId");
