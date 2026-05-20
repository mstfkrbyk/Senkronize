-- costPrice zaten 20260518250000_add_product_variants migration'ında eklenmiş olabilir; idempotent tutulur.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(12,2);
