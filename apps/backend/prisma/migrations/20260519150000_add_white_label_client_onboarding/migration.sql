-- CreateTable
CREATE TABLE "WhiteLabelSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "customDomain" TEXT,
    "hideSenkronize" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteLabelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOnboarding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientOrgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteEmail" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "inviteExpiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhiteLabelSettings_organizationId_key" ON "WhiteLabelSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOnboarding_inviteToken_key" ON "ClientOnboarding"("inviteToken");

-- CreateIndex
CREATE INDEX "ClientOnboarding_organizationId_status_idx" ON "ClientOnboarding"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "WhiteLabelSettings" ADD CONSTRAINT "WhiteLabelSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
