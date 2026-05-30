-- CreateEnum
CREATE TYPE "IntegrationPolicyCategory" AS ENUM ('MARKETPLACE', 'ECOMMERCE', 'ERP');

-- CreateTable
CREATE TABLE "IntegrationPlatformPolicy" (
    "platformKey" TEXT NOT NULL,
    "category" "IntegrationPolicyCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "orderSyncIntervalMinutes" INTEGER,
    "orderLookbackMinutes" INTEGER,
    "listingSyncHour" INTEGER,
    "maxRequestsPerHour" INTEGER,
    "requestsPerMinute" INTEGER,
    "syncFrequency" "SyncFrequency",
    "customSettings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "IntegrationPlatformPolicy_pkey" PRIMARY KEY ("platformKey")
);

-- Migrate global settings into per-platform rows when legacy table exists
INSERT INTO "IntegrationPlatformPolicy" (
    "platformKey",
    "category",
    "maxRequestsPerHour",
    "syncFrequency",
    "updatedAt"
)
SELECT
    'BIZIMHESAP',
    'ERP'::"IntegrationPolicyCategory",
    "bizimhesapMaxRequestsPerHour",
    "defaultErpSyncFrequency",
    CURRENT_TIMESTAMP
FROM "PlatformSyncSettings"
WHERE "id" = 'default'
ON CONFLICT ("platformKey") DO NOTHING;

INSERT INTO "IntegrationPlatformPolicy" (
    "platformKey",
    "category",
    "orderSyncIntervalMinutes",
    "orderLookbackMinutes",
    "listingSyncHour",
    "updatedAt"
)
SELECT 'TICIMAX', 'ECOMMERCE'::"IntegrationPolicyCategory", "orderSyncIntervalMinutes", "orderLookbackMinutes", "listingSyncHour", CURRENT_TIMESTAMP
FROM "PlatformSyncSettings" WHERE "id" = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO "IntegrationPlatformPolicy" (
    "platformKey",
    "category",
    "orderSyncIntervalMinutes",
    "orderLookbackMinutes",
    "updatedAt"
)
SELECT 'TRENDYOL', 'MARKETPLACE'::"IntegrationPolicyCategory", "orderSyncIntervalMinutes", "orderLookbackMinutes", CURRENT_TIMESTAMP
FROM "PlatformSyncSettings" WHERE "id" = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO "IntegrationPlatformPolicy" (
    "platformKey",
    "category",
    "orderSyncIntervalMinutes",
    "orderLookbackMinutes",
    "updatedAt"
)
SELECT 'HEPSIBURADA', 'MARKETPLACE'::"IntegrationPolicyCategory", "orderSyncIntervalMinutes", "orderLookbackMinutes", CURRENT_TIMESTAMP
FROM "PlatformSyncSettings" WHERE "id" = 'default'
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS "PlatformSyncSettings";
