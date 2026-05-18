-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT;
