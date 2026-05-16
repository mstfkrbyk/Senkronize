-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('SUBSCRIPTION_FEE', 'SERVICE_FEE', 'BONUS', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'SETTLED', 'CANCELLED');

-- PartnerStatus: ACTIVE | PAUSED | TERMINATED -> PENDING | ACTIVE | SUSPENDED | TERMINATED
BEGIN;
CREATE TYPE "PartnerStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
ALTER TABLE "PartnerRelationship" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PartnerRelationship" ALTER COLUMN "status" TYPE "PartnerStatus_new" USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'ACTIVE'::"PartnerStatus_new"
    WHEN 'PAUSED' THEN 'SUSPENDED'::"PartnerStatus_new"
    WHEN 'TERMINATED' THEN 'TERMINATED'::"PartnerStatus_new"
    ELSE 'PENDING'::"PartnerStatus_new"
  END
);
ALTER TYPE "PartnerStatus" RENAME TO "PartnerStatus_old";
ALTER TYPE "PartnerStatus_new" RENAME TO "PartnerStatus";
DROP TYPE "PartnerStatus_old";
ALTER TABLE "PartnerRelationship" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PartnerStatus";
COMMIT;

-- PartnerRelationship column renames + invite fields
ALTER TABLE "PartnerRelationship" RENAME COLUMN "partnerId" TO "partnerOrgId";
ALTER TABLE "PartnerRelationship" RENAME COLUMN "clientId" TO "clientOrgId";
ALTER TABLE "PartnerRelationship" RENAME COLUMN "commissionRate" TO "commissionPct";

ALTER TABLE "PartnerRelationship" ALTER COLUMN "clientOrgId" DROP NOT NULL;

ALTER TABLE "PartnerRelationship" ADD COLUMN "invitedEmail" TEXT;
ALTER TABLE "PartnerRelationship" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "PartnerRelationship" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "PartnerRelationship" ADD COLUMN "acceptedAt" TIMESTAMP(3);

ALTER TABLE "PartnerRelationship" ALTER COLUMN "canImpersonate" SET DEFAULT true;

DROP INDEX IF EXISTS "PartnerRelationship_partnerId_clientId_key";

CREATE UNIQUE INDEX "PartnerRelationship_inviteToken_key" ON "PartnerRelationship"("inviteToken");

CREATE INDEX "PartnerRelationship_partnerOrgId_idx" ON "PartnerRelationship"("partnerOrgId");
CREATE INDEX "PartnerRelationship_clientOrgId_idx" ON "PartnerRelationship"("clientOrgId");
CREATE INDEX "PartnerRelationship_partnerOrgId_invitedEmail_idx" ON "PartnerRelationship"("partnerOrgId", "invitedEmail");

CREATE UNIQUE INDEX "PartnerRelationship_partnerOrgId_clientOrgId_key" ON "PartnerRelationship"("partnerOrgId", "clientOrgId");

-- CommissionLedger: denormalize org ids, new columns, LedgerStatus
ALTER TABLE "CommissionLedger" DROP CONSTRAINT IF EXISTS "CommissionLedger_partnerRelationshipId_fkey";

ALTER TABLE "CommissionLedger" ADD COLUMN "partnerOrgId" TEXT;
ALTER TABLE "CommissionLedger" ADD COLUMN "ledgerClientOrgId" TEXT;

UPDATE "CommissionLedger" AS cl
SET "partnerOrgId" = pr."partnerOrgId", "ledgerClientOrgId" = pr."clientOrgId"
FROM "PartnerRelationship" AS pr
WHERE cl."partnerRelationshipId" = pr.id;

ALTER TABLE "CommissionLedger" DROP COLUMN "partnerRelationshipId";

ALTER TABLE "CommissionLedger" ADD COLUMN "type" "CommissionType" NOT NULL DEFAULT 'SUBSCRIPTION_FEE';
ALTER TABLE "CommissionLedger" ADD COLUMN "description" TEXT;
ALTER TABLE "CommissionLedger" ADD COLUMN "referenceId" TEXT;
UPDATE "CommissionLedger" SET "referenceId" = "subscriptionEventId" WHERE "subscriptionEventId" IS NOT NULL;
ALTER TABLE "CommissionLedger" DROP COLUMN "subscriptionEventId";

ALTER TABLE "CommissionLedger" ADD COLUMN "ledgerStatus" "LedgerStatus";
UPDATE "CommissionLedger" SET "ledgerStatus" = CASE "status"::text
  WHEN 'PAID' THEN 'SETTLED'::"LedgerStatus"
  WHEN 'PENDING' THEN 'PENDING'::"LedgerStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"LedgerStatus"
  ELSE 'PENDING'::"LedgerStatus"
  END;
ALTER TABLE "CommissionLedger" DROP COLUMN "status";
ALTER TABLE "CommissionLedger" RENAME COLUMN "ledgerStatus" TO "status";
ALTER TABLE "CommissionLedger" ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "CommissionLedger" RENAME COLUMN "ledgerClientOrgId" TO "clientOrgId";

ALTER TABLE "CommissionLedger" ALTER COLUMN "partnerOrgId" SET NOT NULL;
ALTER TABLE "CommissionLedger" ALTER COLUMN "clientOrgId" SET NOT NULL;

ALTER TABLE "CommissionLedger" ADD COLUMN "settledAt" TIMESTAMP(3);

CREATE INDEX "CommissionLedger_partnerOrgId_idx" ON "CommissionLedger"("partnerOrgId");
CREATE INDEX "CommissionLedger_clientOrgId_idx" ON "CommissionLedger"("clientOrgId");

ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_partnerOrgId_fkey" FOREIGN KEY ("partnerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TYPE "CommissionStatus";
