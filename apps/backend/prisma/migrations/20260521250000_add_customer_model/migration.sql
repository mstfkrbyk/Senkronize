-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT,
    "platform" "Marketplace",
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'TR',
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "tags" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_email_idx" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_platform_externalId_key" ON "Customer"("organizationId", "platform", "externalId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
