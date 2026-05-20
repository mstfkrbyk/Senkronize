import type { MigrationDataType } from './migration.types';

export function applyColumnMapping(
  row: Record<string, string>,
  columnMapping: Record<string, string>,
): Record<string, string> {
  if (Object.keys(columnMapping).length === 0) {
    return row;
  }
  const mapped: Record<string, string> = { ...row };
  for (const [targetField, sourceColumn] of Object.entries(columnMapping)) {
    if (!sourceColumn) {
      continue;
    }
    const value = row[sourceColumn];
    if (value !== undefined) {
      mapped[targetField] = value;
    }
  }
  return mapped;
}

export function suggestColumnMapping(
  headers: string[],
  dataType: MigrationDataType,
): Record<string, string> {
  const norm = (h: string) =>
    h.trim().toLowerCase().replace(/\s+/g, '').replace(/^\uFEFF/, '');

  const find = (candidates: string[]): string | undefined => {
    for (const h of headers) {
      if (candidates.includes(norm(h))) {
        return h;
      }
    }
    return undefined;
  };

  if (dataType === 'products') {
    return {
      name: find(['name', 'ad', 'urunadi', 'title', 'baslik']) ?? '',
      sku: find(['sku', 'stokkodu']) ?? '',
      barcode: find(['barcode', 'barkod', 'sku']) ?? '',
      price: find(['price', 'fiyat', 'saleprice', 'satisfiyati']) ?? '',
      stock: find(['stock', 'stok', 'quantity']) ?? '',
      category: find(['category', 'kategori']) ?? '',
      imageUrl: find(['imageurl', 'gorsel', 'resim']) ?? '',
    };
  }

  if (dataType === 'orders') {
    return {
      platformOrderId: find(['platformorderid', 'orderid', 'siparisno']) ?? '',
      platform: find(['platform', 'pazaryeri']) ?? '',
      orderDate: find(['orderdate', 'tarih', 'date']) ?? '',
      customerName: find(['customername', 'musteri', 'alici']) ?? '',
      totalAmount: find(['totalamount', 'tutar', 'total']) ?? '',
      itemSku: find(['itemsku', 'sku']) ?? '',
      itemBarcode: find(['itembarcode', 'barcode', 'barkod']) ?? '',
    };
  }

  if (dataType === 'customers') {
    return {
      name: find(['name', 'ad', 'musteri']) ?? '',
      email: find(['email', 'eposta']) ?? '',
      phone: find(['phone', 'telefon']) ?? '',
      platform: find(['platform', 'pazaryeri']) ?? '',
    };
  }

  return {
    barcode: find(['barcode', 'barkod', 'sku']) ?? '',
    movementType: find(['movementtype', 'tip', 'type']) ?? '',
    quantity: find(['quantity', 'miktar', 'adet']) ?? '',
    date: find(['date', 'tarih']) ?? '',
  };
}
