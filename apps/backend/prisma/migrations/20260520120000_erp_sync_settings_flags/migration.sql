-- AlterTable
ALTER TABLE "ErpSyncSettings" ADD COLUMN "syncPrices" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ErpSyncSettings" ADD COLUMN "syncCustomers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ErpSyncSettings" ADD COLUMN "autoCreateInvoice" BOOLEAN NOT NULL DEFAULT false;
