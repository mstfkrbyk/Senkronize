-- Kayıtlı özel raporlar ve rapor tipi enum
CREATE TYPE "ReportType" AS ENUM (
  'ORDERS',
  'PRODUCTS',
  'LISTINGS',
  'STOCK',
  'PROFIT',
  'PLATFORM_COMPARISON',
  'CUSTOM'
);

CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportType" "ReportType" NOT NULL,
    "config" JSONB NOT NULL,
    "schedule" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedReport_organizationId_idx" ON "SavedReport"("organizationId");

ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
