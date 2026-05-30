import { isKnownOrderStatus, orderStatusLabel } from '@/lib/order-status';
import type { ConflictType } from '@/types/sync-conflict';

/** entityId / tabloda zaten gösterilen veya teknik alanlar */
const INTERNAL_KEYS = new Set([
  'barcode',
  'organizationId',
  'listingId',
  'productId',
  'connectionId',
  'sku',
]);

const FIELD_LABELS: Record<string, string> = {
  quantity: 'Stok',
  salePrice: 'Satış fiyatı',
  listPrice: 'Liste fiyatı',
  status: 'Durum',
  localStatus: 'Yerel durum',
  remoteStatus: 'Platform durumu',
  name: 'Ürün adı',
  productName: 'Ürün adı',
  platformOrderId: 'Platform sipariş no',
  orderNumber: 'Sipariş no',
  externalOrderId: 'Harici sipariş no',
  orderId: 'Sipariş kimliği',
};

interface StockValuePayload {
  quantity: number;
  barcode: string;
}

interface PriceValuePayload {
  salePrice: number;
  listPrice: number;
  barcode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStockPayload(value: unknown): value is StockValuePayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    typeof value.barcode === 'string'
  );
}

function isPricePayload(value: unknown): value is PriceValuePayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.salePrice === 'number' &&
    Number.isFinite(value.salePrice) &&
    typeof value.listPrice === 'number' &&
    Number.isFinite(value.listPrice) &&
    typeof value.barcode === 'string'
  );
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString('tr-TR');
}

function formatStatusToken(status: unknown): string {
  if (typeof status !== 'string' || status.length === 0) {
    return '—';
  }
  if (isKnownOrderStatus(status)) {
    return orderStatusLabel(status);
  }
  return status;
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Evet' : 'Hayır';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('tr-TR');
  }
  return String(value);
}

function formatFieldValue(key: string, value: unknown): string {
  if (key === 'status' || key === 'localStatus' || key === 'remoteStatus') {
    return formatStatusToken(value);
  }
  if (
    (key === 'salePrice' || key === 'listPrice') &&
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return formatMoney(value);
  }
  if (key === 'quantity' && typeof value === 'number' && Number.isFinite(value)) {
    return formatQuantity(value);
  }
  return formatPrimitive(value);
}

function formatStockValue(value: unknown): string {
  if (isStockPayload(value)) {
    return `${FIELD_LABELS.quantity}: ${formatQuantity(value.quantity)}`;
  }
  return formatLabeledFields(value);
}

function formatPriceValue(value: unknown): string {
  if (isPricePayload(value)) {
    return [
      `${FIELD_LABELS.salePrice}: ${formatMoney(value.salePrice)}`,
      `${FIELD_LABELS.listPrice}: ${formatMoney(value.listPrice)}`,
    ].join(' · ');
  }
  return formatLabeledFields(value);
}

function formatStatusMismatchValue(value: unknown): string {
  if (!isRecord(value)) {
    return formatPrimitive(value);
  }
  const parts: string[] = [];
  if ('localStatus' in value && value.localStatus !== undefined) {
    parts.push(
      `${FIELD_LABELS.localStatus}: ${formatStatusToken(value.localStatus)}`,
    );
  }
  if ('remoteStatus' in value && value.remoteStatus !== undefined) {
    parts.push(
      `${FIELD_LABELS.remoteStatus}: ${formatStatusToken(value.remoteStatus)}`,
    );
  }
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  if ('status' in value) {
    return `${FIELD_LABELS.status}: ${formatStatusToken(value.status)}`;
  }
  return formatLabeledFields(value);
}

function formatLabeledFields(value: unknown): string {
  if (!isRecord(value)) {
    return formatPrimitive(value);
  }

  const parts: string[] = [];
  for (const [key, fieldValue] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(key)) {
      continue;
    }
    if (fieldValue === null || fieldValue === undefined) {
      continue;
    }
    const label = FIELD_LABELS[key] ?? key;
    parts.push(`${label}: ${formatFieldValue(key, fieldValue)}`);
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return '—';
}

/**
 * Çakışma satırındaki yerel/uzak JSON değerini kullanıcıya Türkçe özet metne çevirir.
 */
export function formatConflictValue(
  conflictType: ConflictType,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (conflictType) {
    case 'STOCK_MISMATCH':
      return formatStockValue(value);
    case 'PRICE_MISMATCH':
      return formatPriceValue(value);
    case 'STATUS_MISMATCH':
      return formatStatusMismatchValue(value);
    case 'PRODUCT_NOT_FOUND':
    case 'DUPLICATE_ORDER':
      return formatLabeledFields(value);
    default: {
      const exhaustive: never = conflictType;
      return formatLabeledFields(exhaustive);
    }
  }
}
