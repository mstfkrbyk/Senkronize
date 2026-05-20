import type { WidgetSize, WidgetType } from '@/types/dashboard-widgets';

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'revenue-chart',
  'orders-summary',
  'platform-breakdown',
  'stock-alerts',
  'sync-status',
  'top-products',
  'recent-orders',
  'buybox-rate',
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  'revenue-chart': 'Gelir grafiği',
  'orders-summary': 'Sipariş özeti',
  'platform-breakdown': 'Platform dağılımı',
  'stock-alerts': 'Kritik stok listesi',
  'sync-status': 'Senkronizasyon durumu',
  'top-products': 'En çok satan ürünler',
  'recent-orders': 'Son siparişler',
  'buybox-rate': 'BuyBox oranı',
};

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, WidgetSize> = {
  'revenue-chart': '2x1',
  'orders-summary': '2x1',
  'platform-breakdown': '1x1',
  'stock-alerts': '1x1',
  'sync-status': '1x1',
  'top-products': '2x1',
  'recent-orders': '2x1',
  'buybox-rate': '1x1',
};

export function widgetGridClass(size: WidgetSize): string {
  if (size === '2x2') {
    return 'col-span-1 row-span-2 sm:col-span-2 sm:row-span-2 min-h-[20rem]';
  }
  if (size === '2x1') {
    return 'col-span-1 sm:col-span-2 min-h-[16rem]';
  }
  return 'col-span-1 min-h-[10rem]';
}
