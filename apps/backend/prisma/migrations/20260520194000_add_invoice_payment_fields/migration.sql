-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentMethod" VARCHAR(32);
