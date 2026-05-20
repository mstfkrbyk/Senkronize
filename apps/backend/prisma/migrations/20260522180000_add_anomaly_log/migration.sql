-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('FAILED_LOGIN_BURST', 'MULTI_COUNTRY_LOGIN', 'API_RATE_SPIKE', 'NIGHT_ACTIVITY');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "require2FA" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "passwordMinLength" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "Organization" ADD COLUMN "passwordRequireSpecial" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "passwordMaxAgeDays" INTEGER NOT NULL DEFAULT 90;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable UserSession
ALTER TABLE "UserSession" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable AnomalyLog
CREATE TABLE "AnomalyLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnomalyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable PasswordHistory
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnomalyLog_organizationId_resolved_createdAt_idx" ON "AnomalyLog"("organizationId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "AnomalyLog_userId_idx" ON "AnomalyLog"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "AnomalyLog" ADD CONSTRAINT "AnomalyLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
