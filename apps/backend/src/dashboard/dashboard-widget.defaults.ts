import type { DashboardWidgetConfig } from './dashboard.types';

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'w-kpi-revenue', type: 'kpi-revenue', size: '1x1', position: 0, visible: true },
  { id: 'w-kpi-orders', type: 'kpi-orders', size: '1x1', position: 1, visible: true },
  { id: 'w-kpi-listings', type: 'kpi-listings', size: '1x1', position: 2, visible: true },
  { id: 'w-kpi-buybox', type: 'kpi-buybox', size: '1x1', position: 3, visible: true },
  { id: 'w-revenue', type: 'revenue-chart', size: '2x1', position: 4, visible: true },
  { id: 'w-platform', type: 'platform-breakdown', size: '1x1', position: 5, visible: true },
  { id: 'w-recent', type: 'recent-orders', size: '2x1', position: 6, visible: true },
  { id: 'w-stock', type: 'stock-alerts', size: '1x1', position: 7, visible: true },
  { id: 'w-top', type: 'top-products', size: '2x1', position: 8, visible: true },
  { id: 'w-sync', type: 'sync-status', size: '1x1', position: 9, visible: true },
  { id: 'w-buybox', type: 'buybox-rate', size: '1x1', position: 10, visible: false },
];
