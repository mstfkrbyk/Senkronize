-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "ConflictType" AS ENUM ('STOCK_MISMATCH', 'PRICE_MISMATCH', 'STATUS_MISMATCH', 'PRODUCT_NOT_FOUND', 'DUPLICATE_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ConflictResolution" AS ENUM ('USE_LOCAL', 'USE_REMOTE', 'MANUAL', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "SyncConflict" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "Marketplace" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "localValue" JSONB NOT NULL,
    "remoteValue" JSONB NOT NULL,
    "resolution" "ConflictResolution",
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "SyncConflict_organizationId_resolution_idx" ON "SyncConflict"("organizationId", "resolution");
CREATE INDEX IF NOT EXISTS "SyncConflict_organizationId_entityType_idx" ON "SyncConflict"("organizationId", "entityType");
CREATE INDEX IF NOT EXISTS "SyncConflict_organizationId_conflictType_idx" ON "SyncConflict"("organizationId", "conflictType");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
