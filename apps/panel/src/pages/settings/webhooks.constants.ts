export const WEBHOOK_EVENTS = [
  { id: 'order.created', label: 'Sipariş oluşturuldu', group: 'Sipariş' },
  { id: 'order.updated', label: 'Sipariş güncellendi', group: 'Sipariş' },
  { id: 'order.shipped', label: 'Sipariş kargolandı', group: 'Sipariş' },
  { id: 'order.delivered', label: 'Sipariş teslim edildi', group: 'Sipariş' },
  { id: 'order.cancelled', label: 'Sipariş iptal edildi', group: 'Sipariş' },
  { id: 'order.returned', label: 'Sipariş iade edildi', group: 'Sipariş' },
  { id: 'product.created', label: 'Ürün oluşturuldu', group: 'Ürün/Stok' },
  { id: 'product.updated', label: 'Ürün güncellendi', group: 'Ürün/Stok' },
  { id: 'stock.low', label: 'Stok düşük', group: 'Ürün/Stok' },
  { id: 'stock.out', label: 'Stok tükendi', group: 'Ürün/Stok' },
  { id: 'stock.updated', label: 'Stok güncellendi', group: 'Ürün/Stok' },
  { id: 'price.changed', label: 'Fiyat değişti', group: 'Fiyat' },
  { id: 'buybox.won', label: 'BuyBox kazanıldı', group: 'Fiyat' },
  { id: 'buybox.lost', label: 'BuyBox kaybedildi', group: 'Fiyat' },
  { id: 'sync.completed', label: 'Senkronizasyon tamamlandı', group: 'Sistem' },
  { id: 'sync.failed', label: 'Senkronizasyon başarısız', group: 'Sistem' },
  { id: 'subscription.renewed', label: 'Abonelik yenilendi', group: 'Sistem' },
  { id: 'subscription.cancelled', label: 'Abonelik iptal edildi', group: 'Sistem' },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]['id'];

export interface WebhookEndpointRow {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
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
