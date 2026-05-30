-- Bağlantı ve ürün bazında stok/fiyat push ayarları
ALTER TABLE "MarketplaceConnection"
ADD COLUMN "pushStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushPrice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product"
ADD COLUMN "pushStockEnabled" BOOLEAN,
ADD COLUMN "pushPriceEnabled" BOOLEAN;
