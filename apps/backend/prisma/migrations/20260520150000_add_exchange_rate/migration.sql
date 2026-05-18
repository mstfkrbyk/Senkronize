-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TCMB',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_targetCurrency_fetchedAt_key" ON "ExchangeRate"("baseCurrency", "targetCurrency", "fetchedAt");

-- CreateIndex
CREATE INDEX "ExchangeRate_baseCurrency_targetCurrency_idx" ON "ExchangeRate"("baseCurrency", "targetCurrency");

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'TRY';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "currencyPreferManualRates" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "currencyManualRates" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "currencyTcmbEnabled" BOOLEAN NOT NULL DEFAULT true;
