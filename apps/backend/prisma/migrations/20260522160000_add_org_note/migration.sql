-- AlterTable
ALTER TABLE "User" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrgNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgNote_orgId_idx" ON "OrgNote"("orgId");

-- AddForeignKey
ALTER TABLE "OrgNote" ADD CONSTRAINT "OrgNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
