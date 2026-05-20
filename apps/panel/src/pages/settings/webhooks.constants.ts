export const WEBHOOK_EVENTS = [
  { id: 'order.created', label: 'Sipariş oluşturuldu', group: 'Sipariş' },
  { id: 'order.status_changed', label: 'Sipariş durumu değişti', group: 'Sipariş' },
  { id: 'order.shipped', label: 'Sipariş kargolandı', group: 'Sipariş' },
  { id: 'order.delivered', label: 'Sipariş teslim edildi', group: 'Sipariş' },
  { id: 'order.cancelled', label: 'Sipariş iptal edildi', group: 'Sipariş' },
  { id: 'product.created', label: 'Ürün oluşturuldu', group: 'Ürün' },
  { id: 'product.updated', label: 'Ürün güncellendi', group: 'Ürün' },
  { id: 'product.deleted', label: 'Ürün silindi', group: 'Ürün' },
  { id: 'stock.low', label: 'Stok düşük', group: 'Stok' },
  { id: 'stock.out', label: 'Stok tükendi', group: 'Stok' },
  { id: 'stock.updated', label: 'Stok güncellendi', group: 'Stok' },
  { id: 'price.changed', label: 'Fiyat değişti', group: 'Fiyat' },
  { id: 'buybox.won', label: 'BuyBox kazanıldı', group: 'Fiyat' },
  { id: 'buybox.lost', label: 'BuyBox kaybedildi', group: 'Fiyat' },
  { id: 'sync.completed', label: 'Senkronizasyon tamamlandı', group: 'Senkronizasyon' },
  { id: 'sync.failed', label: 'Senkronizasyon başarısız', group: 'Senkronizasyon' },
  { id: 'subscription.upgraded', label: 'Abonelik yükseltildi', group: 'Abonelik' },
  { id: 'subscription.cancelled', label: 'Abonelik iptal edildi', group: 'Abonelik' },
  { id: 'subscription.expired', label: 'Abonelik süresi doldu', group: 'Abonelik' },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]['id'];

export interface WebhookEndpointRow {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
  status: 'ACTIVE' | 'DISABLED';
  isActive: boolean;
  retryCount: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
  lastDeliveryStatus?: string | null;
  lastDeliveryStatusCode?: number | null;
  lastDeliveryAt?: string | null;
}

export interface WebhookEndpointCreated extends WebhookEndpointRow {
  secret: string;
}

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  responseBody: string | null;
  duration: number | null;
  attempt: number;
  status: string;
  createdAt: string;
}

export interface WebhookDeliveryLogsResponse {
  data: WebhookDeliveryRow[];
  total: number;
  page: number;
  limit: number;
}

export function formatWebhookDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '—';
  }
}

export function deliveryStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'SUCCESS':
      return 'Başarılı';
    case 'FAILED':
      return 'Başarısız';
    case 'PENDING':
      return 'Bekliyor';
    case 'RETRYING':
      return 'Yeniden deneniyor';
    default:
      return status ?? '—';
  }
}

export function endpointStatusLabel(
  status: WebhookEndpointRow['status'],
  isActive: boolean,
): string {
  if (status === 'DISABLED') {
    return 'Devre dışı';
  }
  return isActive ? 'Aktif' : 'Pasif';
}
