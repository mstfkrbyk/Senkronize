import type { WidgetSize, WidgetType } from '@/types/dashboard-widgets';

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'kpi-revenue',
  'kpi-orders',
  'kpi-products',
  'kpi-stock-alerts',
  'chart-sales',
  'chart-platforms',
  'table-orders',
  'table-stock',
  'kpi-listings',
  'kpi-buybox',
  'revenue-chart',
  'platform-breakdown',
  'recent-orders',
  'stock-alerts',
  'top-products',
  'sync-status',
  'buybox-rate',
  'accounting-kpi',
  'accounting-recent-invoices',
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  'kpi-revenue': 'Toplam gelir',
  'kpi-orders': 'Toplam sipariş',
  'kpi-products': 'Aktif ürün',
  'kpi-stock-alerts': 'Stok uyarısı',
  'chart-sales': 'Satış trendi',
  'chart-platforms': 'Platform dağılımı',
  'table-orders': 'Son siparişler',
  'table-stock': 'Kritik stok',
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
  'accounting-kpi': 'Ön muhasebe özeti',
  'accounting-recent-invoices': 'Son faturalar',
};

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, WidgetSize> = {
  'kpi-revenue': '1x1',
  'kpi-orders': '1x1',
  'kpi-products': '1x1',
  'kpi-stock-alerts': '1x1',
  'chart-sales': '2x1',
  'chart-platforms': '1x1',
  'table-orders': '1x1',
  'table-stock': '1x1',
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
  'accounting-kpi': '2x1',
  'accounting-recent-invoices': '2x1',
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
