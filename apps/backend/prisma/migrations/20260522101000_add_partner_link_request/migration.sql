-- CreateEnum
CREATE TYPE "PartnerLinkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PartnerLinkRequest" (
    "id" TEXT NOT NULL,
    "clientOrgId" TEXT NOT NULL,
    "partnerOrgId" TEXT NOT NULL,
    "status" "PartnerLinkStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "PartnerLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerLinkRequest_status_idx" ON "PartnerLinkRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLinkRequest_clientOrgId_partnerOrgId_key" ON "PartnerLinkRequest"("clientOrgId", "partnerOrgId");

-- AddForeignKey
ALTER TABLE "PartnerLinkRequest" ADD CONSTRAINT "PartnerLinkRequest_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLinkRequest" ADD CONSTRAINT "PartnerLinkRequest_partnerOrgId_fkey" FOREIGN KEY ("partnerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
