-- ERP bağlantısı: ErpType enum güncellemesi, type -> erpType, soft-delete ve senkron alanları
DELETE FROM "ErpConnection";

ALTER TABLE "ErpConnection" DROP COLUMN "type";

DROP TYPE "ErpType";

CREATE TYPE "ErpType" AS ENUM ('BIZIMHESAP', 'PARASUT', 'TSOFT', 'TICIMAX', 'LOGO');

ALTER TABLE "ErpConnection" ADD COLUMN "erpType" "ErpType" NOT NULL;

ALTER TABLE "ErpConnection" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ErpConnection" ADD COLUMN "syncErrorCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ErpConnection" ADD COLUMN "lastErrorAt" TIMESTAMP(3);

ALTER TABLE "ErpConnection" ADD COLUMN "lastErrorMessage" TEXT;

CREATE UNIQUE INDEX "ErpConnection_organizationId_erpType_key" ON "ErpConnection"("organizationId", "erpType");

CREATE INDEX "ErpConnection_organizationId_idx" ON "ErpConnection"("organizationId");
