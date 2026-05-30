import type { LucideIcon } from 'lucide-react';
import {
  Braces,
  FileSpreadsheet,
  ShoppingBag,
  Store,
} from 'lucide-react';

import type { MigrationDataType, MigrationSourceFormat } from '@/types/migration';

export type MigrationPlatformId =
  | 'ENTEGRA'
  | 'WOOCOMMERCE'
  | 'SHOPIFY'
  | 'TICIMAX'
  | 'EXCEL_CSV'
  | 'JSON';

export interface MigrationPlatformOption {
  id: MigrationPlatformId;
  title: string;
  description: string;
  icon: LucideIcon;
  sourceFormatHint: MigrationSourceFormat;
}

export const MIGRATION_PLATFORMS: MigrationPlatformOption[] = [
  {
    id: 'ENTEGRA',
    title: 'Entegra',
    description: 'Entegra dışa aktarım dosyanızı yükleyin.',
    icon: Store,
    sourceFormatHint: 'entegra_json',
  },
  {
    id: 'WOOCOMMERCE',
    title: 'WooCommerce',
    description: 'WooCommerce CSV veya XML dışa aktarımı.',
    icon: ShoppingBag,
    sourceFormatHint: 'woocommerce_csv',
  },
  {
    id: 'SHOPIFY',
    title: 'Shopify',
    description: 'Shopify ürün ve sipariş dışa aktarımı.',
    icon: Store,
    sourceFormatHint: 'shopify_csv',
  },
  {
    id: 'TICIMAX',
    title: 'Ticimax',
    description: 'Ticimax CSV dışa aktarım dosyası.',
    icon: Store,
    sourceFormatHint: 'ticimax_csv',
  },
  {
    id: 'EXCEL_CSV',
    title: 'Excel / CSV',
    description: 'Genel Excel veya CSV tablo dosyası.',
    icon: FileSpreadsheet,
    sourceFormatHint: 'generic_csv',
  },
  {
    id: 'JSON',
    title: 'JSON',
    description: 'Yapılandırılmış JSON veri dosyası.',
    icon: Braces,
    sourceFormatHint: 'generic_json',
  },
];

export interface MigrationDataTypeOption {
  id: MigrationDataType;
  label: string;
}

export const MIGRATION_DATA_TYPES: MigrationDataTypeOption[] = [
  { id: 'products', label: 'Ürünler' },
  { id: 'orders', label: 'Siparişler' },
  { id: 'stock_movements', label: 'Stok' },
  { id: 'customers', label: 'Müşteriler' },
];

export const DATA_TYPE_PRIORITY: MigrationDataType[] = [
  'products',
  'orders',
  'stock_movements',
  'customers',
];

export const FIELD_LABELS: Record<string, string> = {
  name: 'Ürün Adı',
  sku: 'SKU',
  barcode: 'Barkod',
  price: 'Satış Fiyatı',
  listPrice: 'Liste Fiyatı',
  stock: 'Stok',
  category: 'Kategori',
  brand: 'Marka',
  description: 'Açıklama',
  imageUrl: 'Görsel URL',
  platformOrderId: 'Sipariş No',
  platform: 'Platform',
  orderDate: 'Sipariş Tarihi',
  status: 'Durum',
  customerName: 'Müşteri Adı',
  customerEmail: 'E-posta',
  customerPhone: 'Telefon',
  shippingAddress: 'Teslimat Adresi',
  totalAmount: 'Toplam Tutar',
  currency: 'Para Birimi',
  cargoTrackingNumber: 'Kargo Takip No',
  cargoProvider: 'Kargo Firması',
  itemSku: 'Kalem SKU',
  itemBarcode: 'Kalem Barkod',
  itemName: 'Kalem Adı',
  itemQuantity: 'Kalem Adet',
  itemUnitPrice: 'Kalem Birim Fiyat',
  movementType: 'Hareket Tipi',
  quantity: 'Miktar',
  date: 'Tarih',
  note: 'Not',
  externalId: 'Harici ID',
  email: 'E-posta',
  phone: 'Telefon',
};

export const REQUIRED_FIELDS: Partial<Record<MigrationDataType, string[]>> = {
  products: ['name', 'sku'],
  orders: ['platformOrderId', 'platform'],
  stock_movements: ['barcode', 'quantity'],
  customers: ['name'],
};

export const WIZARD_STEPS = [
  'Kaynak Seç',
  'Dosya Yükle',
  'Sütun Eşleştirme',
  'Doğrulama',
  'İçe Aktarma',
] as const;

export const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
  'text/xml': ['.xml'],
  'application/xml': ['.xml'],
};

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const SOURCE_FORMAT_LABELS: Record<MigrationSourceFormat, string> = {
  generic_csv: 'CSV',
  generic_excel: 'Excel',
  generic_json: 'JSON',
  entegra_json: 'Entegra',
  woocommerce_xml: 'WooCommerce XML',
  woocommerce_csv: 'WooCommerce CSV',
  shopify_csv: 'Shopify',
  ticimax_csv: 'Ticimax',
  kolay_ik_json: 'Kolay IK',
};

export const DATA_TYPE_LABELS: Record<MigrationDataType, string> = {
  products: 'Ürünler',
  orders: 'Siparişler',
  stock_movements: 'Stok',
  customers: 'Müşteriler',
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  uploaded: 'Yüklendi',
  mapped: 'Eşleştirildi',
  validated: 'Doğrulandı',
  queued: 'Kuyrukta',
  processing: 'İşleniyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
};

export function suggestColumnMapping(
  headers: string[],
  dataType: MigrationDataType,
): Record<string, string> {
  const norm = (h: string): string =>
    h.trim().toLowerCase().replace(/\s+/g, '').replace(/^\uFEFF/, '');

  const find = (candidates: string[]): string => {
    for (const h of headers) {
      if (candidates.includes(norm(h))) {
        return h;
      }
    }
    return '';
  };

  if (dataType === 'products') {
    return {
      name: find(['name', 'ad', 'urunadi', 'title', 'baslik']),
      sku: find(['sku', 'stokkodu']),
      barcode: find(['barcode', 'barkod']),
      price: find(['price', 'fiyat', 'saleprice', 'satisfiyati']),
      stock: find(['stock', 'stok', 'quantity']),
      category: find(['category', 'kategori']),
      imageUrl: find(['imageurl', 'gorsel', 'resim']),
    };
  }

  if (dataType === 'orders') {
    return {
      platformOrderId: find(['platformorderid', 'orderid', 'siparisno']),
      platform: find(['platform', 'pazaryeri']),
      orderDate: find(['orderdate', 'tarih', 'date']),
      customerName: find(['customername', 'musteri', 'alici']),
      totalAmount: find(['totalamount', 'tutar', 'total']),
      itemSku: find(['itemsku', 'sku']),
      itemBarcode: find(['itembarcode', 'barcode', 'barkod']),
    };
  }

  if (dataType === 'customers') {
    return {
      name: find(['name', 'ad', 'musteri']),
      email: find(['email', 'eposta']),
      phone: find(['phone', 'telefon']),
      platform: find(['platform', 'pazaryeri']),
    };
  }

  return {
    barcode: find(['barcode', 'barkod', 'sku']),
    movementType: find(['movementtype', 'tip', 'type']),
    quantity: find(['quantity', 'miktar', 'adet']),
    date: find(['date', 'tarih']),
  };
}

export function resolvePrimaryDataType(
  selected: MigrationDataType[],
): MigrationDataType {
  for (const type of DATA_TYPE_PRIORITY) {
    if (selected.includes(type)) {
      return type;
    }
  }
  return 'products';
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([`\ufeff${content}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Teknik/API kodlarını kullanıcıya göstermeden Türkçe mesaja çevirir. */
export function formatMigrationIssueMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return 'Doğrulama hatası';
  }
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(trimmed)) {
    return 'Satır doğrulanamadı. Ayrıntı için hata listesini indirin.';
  }
  if (
    trimmed.startsWith('Error:') ||
    trimmed.includes('statusCode') ||
    trimmed.includes('ECONNREFUSED')
  ) {
    return 'Satır işlenirken beklenmeyen bir hata oluştu.';
  }
  return trimmed;
}

export function buildErrorsCsv(errors: { row: number; field: string; message: string }[]): string {
  const lines = ['satir,alan,hata'];
  for (const err of errors) {
    const msg = err.message.replace(/"/g, '""');
    lines.push(`${err.row},"${err.field}","${msg}"`);
  }
  return lines.join('\n');
}
