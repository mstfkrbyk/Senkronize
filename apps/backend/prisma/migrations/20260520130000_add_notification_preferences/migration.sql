-- AlterTable: genişletilmiş bildirim tercihleri
ALTER TABLE "NotificationPreference" ADD COLUMN "emailNewOrder" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailLowStock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailStockOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailSyncError" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailWeeklyReport" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailTicketReply" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailPlanExpiry" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "pushNewOrder" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "pushLowStock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "pushSyncError" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "inAppEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "inAppSoundEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "digestFrequency" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "NotificationPreference" ADD COLUMN "digestHour" INTEGER NOT NULL DEFAULT 9;

UPDATE "NotificationPreference"
SET
  "emailNewOrder" = "newOrder",
  "emailLowStock" = "stockAlert",
  "emailSyncError" = "syncError",
  "pushNewOrder" = "newOrder",
  "pushSyncError" = "syncError";

-- CreateTable: özet e-posta kuyruğu
CREATE TABLE "NotificationDigestItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDigestItem_userId_createdAt_idx" ON "NotificationDigestItem"("userId", "createdAt");
CREATE INDEX "NotificationDigestItem_organizationId_idx" ON "NotificationDigestItem"("organizationId");

ALTER TABLE "NotificationDigestItem" ADD CONSTRAINT "NotificationDigestItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDigestItem" ADD CONSTRAINT "NotificationDigestItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
