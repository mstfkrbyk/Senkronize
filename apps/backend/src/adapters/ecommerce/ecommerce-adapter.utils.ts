import type { MarketplaceListing, MarketplaceOrder } from '@senkronize/shared';

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function normalizeArrayPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    const keys = [
      'data',
      'items',
      'products',
      'orders',
      'results',
      'records',
      'value',
      'list',
    ] as const;
    for (const k of keys) {
      const v = data[k];
      if (Array.isArray(v)) {
        return v;
      }
    }
    if (isRecord(data.result)) {
      return normalizeArrayPayload(data.result);
    }
  }
  return [];
}

export function totalFromPayload(data: unknown, fallback: number): number {
  if (!isRecord(data)) {
    return fallback;
  }
  const raw = data.totalCount ?? data.total ?? data.count ?? data.meta;
  if (isRecord(raw)) {
    const nested = raw.total ?? raw.itemCount;
    const n = typeof nested === 'number' ? nested : parseInt(String(nested ?? ''), 10);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function mapGenericOrder(row: unknown, index: number): MarketplaceOrder | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = row.id ?? row.orderId ?? row.order_id ?? row.pk ?? row.number;
  if (id === undefined || id === null) {
    return null;
  }
  const linesRaw = row.items ?? row.lines ?? row.orderItems ?? row.line_items;
  const lines = Array.isArray(linesRaw) ? linesRaw : [];
  const items = lines.map((li, i) => {
    const l = isRecord(li) ? li : {};
    const sku = String(l.sku ?? l.barcode ?? l.product_sku ?? '');
    const barcode = String(l.barcode ?? l.sku ?? sku);
    return {
      sku,
      barcode: barcode || String(l.product_id ?? l.id ?? i),
      quantity: parseMoney(l.quantity ?? l.qty),
      unitPrice: parseMoney(l.unitPrice ?? l.price ?? l.amount),
      platformItemId: String(l.id ?? l.line_id ?? (barcode || i)),
      productName: typeof l.name === 'string' ? l.name : undefined,
    };
  });
  const customer =
    typeof row.customerName === 'string'
      ? row.customerName
      : isRecord(row.customer)
        ? String(row.customer.fullName ?? row.customer.name ?? '')
        : String(row.email ?? '—');
  return {
    platformOrderId: String(id),
    status: String(row.status ?? ''),
    customerName: customer.trim() || '—',
    items,
    totalAmount: parseMoney(row.totalAmount ?? row.total ?? row.amount),
    currency: String(row.currency ?? 'TRY'),
    createdAt: new Date(
      String(row.createdAt ?? row.created_at ?? row.date ?? Date.now()),
    ).toISOString(),
  };
}

export function mapGenericProduct(row: unknown, index: number): MarketplaceListing | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = row.id ?? row.productId ?? row.product_id ?? row.pk ?? row.sku;
  if (id === undefined || id === null) {
    return null;
  }
  const barcode = String(row.barcode ?? row.sku ?? row.base_code ?? id);
  const sale = parseMoney(row.salePrice ?? row.price ?? row.retail_price);
  const list = parseMoney(row.listPrice ?? row.oldPrice ?? row.regular_price ?? sale);
  const images: string[] = [];
  if (Array.isArray(row.images)) {
    for (const im of row.images) {
      if (typeof im === 'string') {
        images.push(im);
      } else if (isRecord(im) && typeof im.url === 'string') {
        images.push(im.url);
      } else if (isRecord(im) && typeof im.src === 'string') {
        images.push(im.src);
      }
    }
  }
  return {
    platformProductId: String(id),
    barcode,
    title: String(row.title ?? row.name ?? row.label ?? barcode),
    quantity: parseMoney(row.quantity ?? row.stockAmount ?? row.stock_quantity ?? row.stock),
    salePrice: sale,
    listPrice: list,
    approved: row.isActive !== false && row.status !== 'draft' && row.is_published !== false,
    images,
  };
}

export function mapRowsToOrders(rows: unknown[]): MarketplaceOrder[] {
  return rows
    .map((row, i) => mapGenericOrder(row, i))
    .filter((o): o is MarketplaceOrder => o !== null);
}

export function mapRowsToProducts(rows: unknown[]): MarketplaceListing[] {
  return rows
    .map((row, i) => mapGenericProduct(row, i))
    .filter((p): p is MarketplaceListing => p !== null);
}
