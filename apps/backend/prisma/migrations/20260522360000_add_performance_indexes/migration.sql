-- CreateIndex
CREATE INDEX "Order_organizationId_platform_createdAt_idx" ON "Order"("organizationId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Product_organizationId_isActive_idx" ON "Product"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Listing_organizationId_platform_isActive_idx" ON "Listing"("organizationId", "platform", "isActive");

-- CreateIndex
CREATE INDEX "Listing_productId_platform_idx" ON "Listing"("productId", "platform");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_createdAt_idx" ON "StockMovement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_barcode_warehouseId_idx" ON "StockMovement"("barcode", "warehouseId");
