-- Supplier enhancements
ALTER TABLE "Supplier" ADD COLUMN "country" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE "Supplier" ADD COLUMN "leadTimeDays" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "rating" DECIMAL(3,2);

CREATE INDEX "Supplier_organizationId_country_idx" ON "Supplier"("organizationId", "country");

-- Supplier contact log
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "subject" TEXT,
    "notes" TEXT NOT NULL,
    "contactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierContact_organizationId_supplierId_idx" ON "SupplierContact"("organizationId", "supplierId");

ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Purchase order tracking
ALTER TABLE "PurchaseOrder" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE INDEX "PurchaseOrder_organizationId_createdAt_idx" ON "PurchaseOrder"("organizationId", "createdAt");

-- Purchase order item product link
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "productId" TEXT;

CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
