-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "SubStatus" ADD VALUE 'CANCELING' BEFORE 'CANCELLED';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "billingPeriod" "BillingPeriod",
ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paytrOrderId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "billingPeriod" "BillingPeriod",
ADD COLUMN "iyzicoConversationId" TEXT,
ADD COLUMN "iyzicoCheckoutToken" TEXT,
ADD COLUMN "iyzicoOrderReference" TEXT;

-- CreateTable
CREATE TABLE "IyzicoSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerRefCode" TEXT,
    "subscriptionRefCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IyzicoSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IyzicoPricingPlan" (
    "id" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "productRefCode" TEXT NOT NULL,
    "pricingPlanRefCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IyzicoPricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IyzicoSubscription_organizationId_key" ON "IyzicoSubscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IyzicoSubscription_subscriptionRefCode_key" ON "IyzicoSubscription"("subscriptionRefCode");

-- CreateIndex
CREATE UNIQUE INDEX "IyzicoPricingPlan_pricingPlanRefCode_key" ON "IyzicoPricingPlan"("pricingPlanRefCode");

-- CreateIndex
CREATE UNIQUE INDEX "IyzicoPricingPlan_plan_billingPeriod_key" ON "IyzicoPricingPlan"("plan", "billingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_iyzicoConversationId_key" ON "Payment"("iyzicoConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_iyzicoOrderReference_key" ON "Payment"("iyzicoOrderReference");

-- AddForeignKey
ALTER TABLE "IyzicoSubscription" ADD CONSTRAINT "IyzicoSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
