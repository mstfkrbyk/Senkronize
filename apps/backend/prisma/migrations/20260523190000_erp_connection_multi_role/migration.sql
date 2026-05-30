-- CreateEnum
CREATE TYPE "ErpConnectionRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- AlterTable
ALTER TABLE "ErpConnection" ADD COLUMN "displayName" TEXT;
ALTER TABLE "ErpConnection" ADD COLUMN "role" "ErpConnectionRole" NOT NULL DEFAULT 'PRIMARY';

-- DropIndex
DROP INDEX IF EXISTS "ErpConnection_organizationId_erpType_key";

-- CreateIndex
CREATE INDEX "ErpConnection_organizationId_erpType_idx" ON "ErpConnection"("organizationId", "erpType");
CREATE INDEX "ErpConnection_organizationId_role_idx" ON "ErpConnection"("organizationId", "role");

-- Org başına yalnızca bir aktif birincil ERP
CREATE UNIQUE INDEX "ErpConnection_one_primary_per_org"
  ON "ErpConnection"("organizationId")
  WHERE "role" = 'PRIMARY' AND "deletedAt" IS NULL;
