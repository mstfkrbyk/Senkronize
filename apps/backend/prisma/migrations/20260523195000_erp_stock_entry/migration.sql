-- CreateTable
CREATE TABLE "ErpStockEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "erpConnectionId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT,
    "barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpStockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpStockEntry_organizationId_erpConnectionId_barcode_warehou_key" ON "ErpStockEntry"("organizationId", "erpConnectionId", "barcode", "warehouseId");

-- CreateIndex
CREATE INDEX "ErpStockEntry_organizationId_barcode_idx" ON "ErpStockEntry"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "ErpStockEntry_organizationId_erpConnectionId_idx" ON "ErpStockEntry"("organizationId", "erpConnectionId");

-- AddForeignKey
ALTER TABLE "ErpStockEntry" ADD CONSTRAINT "ErpStockEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpStockEntry" ADD CONSTRAINT "ErpStockEntry_erpConnectionId_fkey" FOREIGN KEY ("erpConnectionId") REFERENCES "ErpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpStockEntry" ADD CONSTRAINT "ErpStockEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpStockEntry" ADD CONSTRAINT "ErpStockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
