-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "SubStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "nextBillingAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaytrSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paytrSubsId" TEXT,
    "paytrCustomerId" TEXT,
    "cardToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaytrSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PaymentStatus" NOT NULL,
    "paytrOrderId" TEXT NOT NULL,
    "paytrPaymentId" TEXT,
    "plan" "PlanTier" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaytrSubscription_organizationId_key" ON "PaytrSubscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaytrSubscription_paytrSubsId_key" ON "PaytrSubscription"("paytrSubsId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paytrOrderId_key" ON "Payment"("paytrOrderId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- AddForeignKey
ALTER TABLE "PaytrSubscription" ADD CONSTRAINT "PaytrSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
