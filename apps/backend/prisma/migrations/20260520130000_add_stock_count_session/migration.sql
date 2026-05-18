-- CreateEnum
CREATE TYPE "StockCountSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountMode" AS ENUM ('FULL', 'PARTIAL');

-- CreateTable
CREATE TABLE "StockCountSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "StockCountSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "countMode" "StockCountMode" NOT NULL,
    "filterBrand" TEXT,
    "filterCategory" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StockCountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "platformLabel" TEXT,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCountSession_organizationId_status_idx" ON "StockCountSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "StockCountItem_sessionId_idx" ON "StockCountItem"("sessionId");

-- CreateIndex
CREATE INDEX "StockCountItem_organizationId_idx" ON "StockCountItem"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountItem_sessionId_barcode_key" ON "StockCountItem"("sessionId", "barcode");

-- AddForeignKey
ALTER TABLE "StockCountSession" ADD CONSTRAINT "StockCountSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountSession" ADD CONSTRAINT "StockCountSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountSession" ADD CONSTRAINT "StockCountSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StockCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
