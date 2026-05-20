-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('REALTIME', 'EVERY_15_MIN', 'HOURLY', 'EVERY_4_HOURS', 'DAILY', 'MANUAL');

-- CreateTable
CREATE TABLE "ErpSyncSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "erpConnectionId" TEXT NOT NULL,
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
    "syncStock" BOOLEAN NOT NULL DEFAULT true,
    "syncProducts" BOOLEAN NOT NULL DEFAULT true,
    "syncInvoices" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpSyncSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpSyncSettings_erpConnectionId_key" ON "ErpSyncSettings"("erpConnectionId");

-- CreateIndex
CREATE INDEX "ErpSyncSettings_organizationId_idx" ON "ErpSyncSettings"("organizationId");

-- CreateIndex
CREATE INDEX "ErpSyncSettings_nextSyncAt_idx" ON "ErpSyncSettings"("nextSyncAt");

-- AddForeignKey
ALTER TABLE "ErpSyncSettings" ADD CONSTRAINT "ErpSyncSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncSettings" ADD CONSTRAINT "ErpSyncSettings_erpConnectionId_fkey" FOREIGN KEY ("erpConnectionId") REFERENCES "ErpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
