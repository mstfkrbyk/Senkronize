-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'ORDER_NEW',
  'ORDER_STATUS_CHANGED',
  'STOCK_LOW',
  'STOCK_OUT',
  'SYNC_SUCCESS',
  'SYNC_ERROR',
  'PRICE_UPDATED',
  'BUYBOX_WON',
  'BUYBOX_LOST',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_FAILED',
  'SYSTEM'
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_organizationId_isRead_createdAt_idx" ON "InAppNotification"("organizationId", "isRead", "createdAt");

CREATE INDEX "InAppNotification_userId_isRead_idx" ON "InAppNotification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
