import type { OrderStatus } from '@/types/order';

export const ORDER_STATUS_LABEL_TR: Record<OrderStatus, string> = {
  NEW: 'Yeni',
  PICKING: 'Hazırlanıyor',
  INVOICED: 'Faturalandı',
  SHIPPED: 'Kargoda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal',
  RETURNED: 'İade',
};

export function orderStatusTone(status: OrderStatus): string {
  const tone: Record<OrderStatus, string> = {
    NEW: 'border-blue-200 bg-blue-50 text-blue-800',
    PICKING: 'border-amber-200 bg-amber-50 text-amber-900',
    INVOICED: 'border-violet-200 bg-violet-50 text-violet-800',
    SHIPPED: 'border-orange-200 bg-orange-50 text-orange-800',
    DELIVERED: 'border-green-200 bg-green-50 text-green-800',
    CANCELLED: 'border-red-200 bg-red-50 text-red-800',
    RETURNED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return tone[status] ?? '';
}
