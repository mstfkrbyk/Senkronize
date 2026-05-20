const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/dashboard/DashboardPage'),
  '/orders': () => import('@/pages/orders/OrdersPage'),
  '/orders/:id': () => import('@/pages/orders/OrderDetailPage'),
  '/customers': () => import('@/pages/customers/CustomersPage'),
  '/customers/segments': () => import('@/pages/customers/CustomerSegmentsPage'),
  '/returns': () => import('@/pages/returns/ReturnsPage'),
  '/listings': () => import('@/pages/listings/ListingsPage'),
  '/products': () => import('@/pages/products/ProductsPage'),
  '/products/import': () => import('@/pages/products/ProductImportPage'),
  '/product-matching': () => import('@/pages/products/ProductMatchingPage'),
  '/categories': () => import('@/pages/categories/CategoriesPage'),
  '/stock': () => import('@/pages/stock/StockManagementPage'),
  '/stock/forecast': () => import('@/pages/stock/StockForecastPage'),
  '/stock/count': () => import('@/pages/stock/StockCountPage'),
  '/stock/transfers': () => import('@/pages/stock/StockTransferPage'),
  '/pricing': () => import('@/pages/pricing/PricingPage'),
  '/campaigns': () => import('@/pages/campaigns/CampaignsPage'),
  '/connections': () => import('@/pages/connections/ConnectionsPage'),
  '/sync-logs': () => import('@/pages/sync-logs/SyncLogsPage'),
  '/sync/history': () => import('@/pages/sync/SyncHistoryPage'),
  '/sync/conflicts': () => import('@/pages/sync/ConflictsPage'),
  '/notifications': () => import('@/pages/notifications/NotificationsPage'),
  '/support': () => import('@/pages/support/SupportPage'),
  '/audit-logs': () => import('@/pages/audit/AuditLogPage'),
  '/reports': () => import('@/pages/reports/ReportsPage'),
  '/migration': () => import('@/pages/migration/MigrationPage'),
  '/partner': () => import('@/pages/partner/PartnerPage'),
  '/settings': () => import('@/pages/settings/SettingsPage'),
  '/settings/webhooks': () => import('@/pages/settings/WebhooksPage'),
  '/suppliers': () => import('@/pages/suppliers/SuppliersPage'),
  '/purchase-orders': () => import('@/pages/suppliers/PurchaseOrdersPage'),
  '/admin': () => import('@/pages/admin/AdminLayout'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  const base = path.split('?')[0] ?? path;
  if (prefetched.has(base)) {
    return;
  }
  const loader =
    routeLoaders[base] ??
    Object.entries(routeLoaders).find(([key]) => base.startsWith(`${key}/`))?.[1];
  if (!loader) {
    return;
  }
  prefetched.add(base);
  void loader();
}
