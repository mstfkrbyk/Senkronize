-- ERP kaynaklı ürünlerin hangi bağlantıdan geldiğini izler (filtre dışı temizlik için)
ALTER TABLE "Product" ADD COLUMN "sourceErpConnectionId" TEXT;

CREATE INDEX "Product_organizationId_sourceErpConnectionId_idx"
  ON "Product"("organizationId", "sourceErpConnectionId");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_sourceErpConnectionId_fkey"
  FOREIGN KEY ("sourceErpConnectionId") REFERENCES "ErpConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
