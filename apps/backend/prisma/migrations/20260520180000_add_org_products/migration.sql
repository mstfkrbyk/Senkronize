-- Organizasyon ürün hatları (entegrasyon / ön muhasebe)
ALTER TABLE "Organization" ADD COLUMN "productLines" JSONB NOT NULL DEFAULT '["INTEGRATION","ACCOUNTING"]';
