-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PICKING', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- Eski Order şeması ile uyumsuz satırları kaldır (geliştirme verisi)
TRUNCATE TABLE "Order";

-- DropIndex
DROP INDEX IF EXISTS "Order_organizationId_externalId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "externalId",
DROP COLUMN "rawPayload",
ADD COLUMN     "cargoProvider" TEXT,
ADD COLUMN     "cargoTrackingNumber" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "platform" "Marketplace" NOT NULL,
ADD COLUMN     "platformCreatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "platformOrderId" TEXT NOT NULL,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL;

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "platformItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_idx" ON "OrderItem"("organizationId");

-- CreateIndex
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_idx" ON "Order"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Order_organizationId_platform_idx" ON "Order"("organizationId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_platform_platformOrderId_key" ON "Order"("organizationId", "platform", "platformOrderId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
