-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "WebhookEndpoint" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WebhookEndpoint" ALTER COLUMN "retryCount" SET DEFAULT 5;
