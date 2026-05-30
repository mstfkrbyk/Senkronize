-- Barkod opsiyonel: barkodsuz ürünler yalnızca SKU ile eşleştirilir
ALTER TABLE "Product" ALTER COLUMN "barcode" DROP NOT NULL;

-- Stok kodu barkod alanına yazılmış kayıtları düzelt (EAN formatı dışı)
UPDATE "Product"
SET
  sku = COALESCE(NULLIF(TRIM(sku), ''), TRIM(barcode)),
  barcode = NULL
WHERE "deletedAt" IS NULL
  AND barcode IS NOT NULL
  AND TRIM(barcode) <> ''
  AND (sku IS NULL OR TRIM(sku) = TRIM(barcode))
  AND barcode !~ '^[0-9]{8,14}$';
