-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "reorderPoint" INTEGER,
ADD COLUMN     "reorderQty" INTEGER,
ADD COLUMN     "leadTimeDays" INTEGER;
