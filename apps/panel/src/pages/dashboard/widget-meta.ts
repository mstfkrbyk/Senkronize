import type { WidgetSize, WidgetType } from '@/types/dashboard-widgets';

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'kpi-revenue',
  'kpi-orders',
  'kpi-listings',
  'kpi-buybox',
  'revenue-chart',
  'platform-breakdown',
  'recent-orders',
  'stock-alerts',
  'top-products',
  'sync-status',
  'buybox-rate',
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  'kpi-revenue': 'Bugünkü gelir',
  'kpi-orders': 'Toplam sipariş',
  'kpi-listings': 'Aktif listeleme',
  'kpi-buybox': 'BuyBox kazanma oranı',
  'revenue-chart': 'Gelir trendi',
  'orders-summary': 'Sipariş özeti',
  'platform-breakdown': 'Platform dağılımı',
  'stock-alerts': 'Stok uyarıları',
  'sync-status': 'Sync durumu',
  'top-products': 'En çok satan ürünler',
  'recent-orders': 'Son siparişler',
  'buybox-rate': 'BuyBox özeti',
};

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, WidgetSize> = {
  'kpi-revenue': '1x1',
  'kpi-orders': '1x1',
  'kpi-listings': '1x1',
  'kpi-buybox': '1x1',
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
