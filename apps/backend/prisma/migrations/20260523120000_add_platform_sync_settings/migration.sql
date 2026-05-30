-- CreateTable
CREATE TABLE "PlatformSyncSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "orderSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "orderLookbackMinutes" INTEGER NOT NULL DEFAULT 35,
    "listingSyncHour" INTEGER NOT NULL DEFAULT 2,
    "bizimhesapMaxRequestsPerHour" INTEGER NOT NULL DEFAULT 10,
    "defaultErpSyncFrequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "PlatformSyncSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSyncSettings" ("id", "orderSyncIntervalMinutes", "orderLookbackMinutes", "listingSyncHour", "bizimhesapMaxRequestsPerHour", "defaultErpSyncFrequency", "updatedAt")
VALUES ('default', 30, 35, 2, 10, 'HOURLY', CURRENT_TIMESTAMP);
