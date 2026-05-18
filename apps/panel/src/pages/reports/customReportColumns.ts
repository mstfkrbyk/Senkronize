import type { ReportType } from '@/types/custom-report';

export interface ColumnDef {
  id: string;
  label: string;
  filterable?: boolean;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ORDERS: 'Siparişler',
  PRODUCTS: 'Ürünler',
  LISTINGS: 'Listelemeler',
  STOCK: 'Stok (depo)',
  PROFIT: 'Kâr',
  PLATFORM_COMPARISON: 'Platform karşılaştırma',
  CUSTOM: 'Özel',
};

export const COLUMNS_BY_TYPE: Record<ReportType, ColumnDef[]> = {
  ORDERS: [
    { id: 'platformOrderId', label: 'Sipariş no', filterable: false },
    { id: 'platform', label: 'Platform', filterable: true },
    { id: 'status', label: 'Durum', filterable: true },
    { id: 'customerName', label: 'Müşteri', filterable: true },
    { id: 'totalAmount', label: 'Tutar', filterable: true },
    { id: 'currency', label: 'Para birimi', filterable: true },
    { id: 'platformCreatedAt', label: 'Sipariş tarihi', filterable: false },
    { id: 'syncedAt', label: 'Senkron', filterable: false },
  ],
  PRODUCTS: [
    { id: 'barcode', label: 'Barkod', filterable: true },
    { id: 'sku', label: 'SKU', filterable: false },
    { id: 'name', label: 'Ad', filterable: true },
    { id: 'brand', label: 'Marka', filterable: true },
    { id: 'category', label: 'Kategori', filterable: true },
    { id: 'costPrice', label: 'Maliyet', filterable: false },
    { id: 'isActive', label: 'Aktif', filterable: true },
    { id: 'createdAt', label: 'Oluşturulma', filterable: false },
  ],
  LISTINGS: [
    { id: 'platform', label: 'Platform', filterable: true },
    { id: 'barcode', label: 'Barkod', filterable: true },
    { id: 'title', label: 'Başlık', filterable: true },
    { id: 'salePrice', label: 'Satış fiyatı', filterable: false },
    { id: 'listPrice', label: 'Liste fiyatı', filterable: false },
    { id: 'quantity', label: 'Adet', filterable: true },
    { id: 'approved', label: 'Onaylı', filterable: true },
    { id: 'lastSyncAt', label: 'Son senkron', filterable: false },
  ],
  STOCK: [
    { id: 'barcode', label: 'Barkod', filterable: true },
    { id: 'platform', label: 'Platform', filterable: true },
    { id: 'quantity', label: 'Miktar', filterable: true },
    { id: 'reservedQty', label: 'Rezerve', filterable: false },
    { id: 'warehouseId', label: 'Depo ID', filterable: true },
    { id: 'updatedAt', label: 'Güncelleme', filterable: false },
  ],
  PROFIT: [
    { id: 'platform', label: 'Platform', filterable: false },
    { id: 'revenue', label: 'Gelir', filterable: false },
    { id: 'orderCount', label: 'Sipariş', filterable: false },
    { id: 'name', label: 'Ürün', filterable: false },
    { id: 'barcode', label: 'Barkod', filterable: false },
    { id: 'quantity', label: 'Adet', filterable: false },
  ],
  PLATFORM_COMPARISON: [
    { id: 'name', label: 'Platform', filterable: false },
    { id: 'orderCount', label: 'Sipariş', filterable: false },
    { id: 'revenue', label: 'Gelir', filterable: false },
    { id: 'avgOrderValue', label: 'Ort. sepet', filterable: false },
    { id: 'returnRate', label: 'İptal/iade %', filterable: false },
    { id: 'syncStatus', label: 'Senkron', filterable: false },
  ],
  CUSTOM: [],
};

export const FILTER_FIELDS_BY_TYPE: Record<ReportType, ColumnDef[]> = {
  ORDERS: COLUMNS_BY_TYPE.ORDERS.filter((c) => c.filterable),
  PRODUCTS: COLUMNS_BY_TYPE.PRODUCTS.filter((c) => c.filterable),
  LISTINGS: COLUMNS_BY_TYPE.LISTINGS.filter((c) => c.filterable),
  STOCK: COLUMNS_BY_TYPE.STOCK.filter((c) => c.filterable),
  PROFIT: [],
  PLATFORM_COMPARISON: [],
  CUSTOM: [],
};

export const GROUP_BY_OPTIONS: Record<ReportType, { id: string; label: string }[]> = {
  ORDERS: [
    { id: 'platform', label: 'Platform' },
    { id: 'status', label: 'Durum' },
  ],
  PRODUCTS: [
    { id: 'brand', label: 'Marka' },
    { id: 'category', label: 'Kategori' },
  ],
  LISTINGS: [
    { id: 'platform', label: 'Platform' },
    { id: 'approved', label: 'Onay durumu' },
  ],
  STOCK: [
    { id: 'platform', label: 'Platform' },
    { id: 'warehouseId', label: 'Depo' },
  ],
  PROFIT: [{ id: 'platform', label: 'Platform' }],
  PLATFORM_COMPARISON: [],
  CUSTOM: [],
};

export const ORDER_BY_OPTIONS: Record<ReportType, { id: string; label: string }[]> = {
  ORDERS: [
    { id: 'platformCreatedAt', label: 'Tarih' },
    { id: 'totalAmount', label: 'Tutar' },
    { id: 'status', label: 'Durum' },
  ],
  PRODUCTS: [
    { id: 'name', label: 'Ad' },
    { id: 'barcode', label: 'Barkod' },
    { id: 'createdAt', label: 'Oluşturulma' },
  ],
  LISTINGS: [
    { id: 'updatedAt', label: 'Güncelleme' },
    { id: 'quantity', label: 'Adet' },
    { id: 'title', label: 'Başlık' },
  ],
  STOCK: [
    { id: 'updatedAt', label: 'Güncelleme' },
    { id: 'quantity', label: 'Adet' },
    { id: 'barcode', label: 'Barkod' },
  ],
  PROFIT: [],
  PLATFORM_COMPARISON: [],
  CUSTOM: [],
};

export function defaultColumnsForType(t: ReportType): string[] {
  const all = COLUMNS_BY_TYPE[t];
  if (all.length === 0) {
    return [];
  }
  return all.slice(0, Math.min(6, all.length)).map((c) => c.id);
}
