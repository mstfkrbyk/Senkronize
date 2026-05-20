import type { WidgetType } from '@/types/dashboard-widgets';

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'kpi_orders',
  'kpi_revenue',
  'kpi_stock_alerts',
  'kpi_buybox_rate',
  'chart_orders',
  'chart_revenue',
  'chart_platform',
  'table_recent_orders',
  'table_low_stock',
  'activity_feed',
  'sync_status',
  'forecast_critical',
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi_orders: 'Sipariş sayısı (KPI)',
  kpi_revenue: 'Gelir (KPI)',
  kpi_stock_alerts: 'Stok uyarıları (KPI)',
  kpi_buybox_rate: 'BuyBox oranı (KPI)',
  chart_orders: 'Sipariş trend grafiği',
  chart_revenue: 'Gelir grafiği',
  chart_platform: 'Platform dağılımı',
  table_recent_orders: 'Son siparişler',
  table_low_stock: 'Düşük stok listesi',
  activity_feed: 'Aktivite akışı',
  sync_status: 'Senkronizasyon durumu',
  forecast_critical: 'Kritik stok tahmini',
};

export function widgetGridClass(size: '1x1' | '2x1' | '2x2'): string {
  if (size === '2x2') {
    return 'col-span-1 row-span-2 sm:col-span-2 sm:row-span-2 min-h-[20rem]';
  }
  if (size === '2x1') {
    return 'col-span-1 sm:col-span-2 min-h-[16rem]';
  }
  return 'col-span-1 min-h-[10rem]';
}
