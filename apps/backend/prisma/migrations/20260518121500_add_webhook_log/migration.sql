-- WebhookLog: merkezi webhook kaydı ve idempotency (platform + payloadHash)
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "platform" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookLog_platform_payloadHash_key" ON "WebhookLog"("platform", "payloadHash");

CREATE INDEX "WebhookLog_platform_createdAt_idx" ON "WebhookLog"("platform", "createdAt");

CREATE INDEX "WebhookLog_organizationId_createdAt_idx" ON "WebhookLog"("organizationId", "createdAt");

ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
