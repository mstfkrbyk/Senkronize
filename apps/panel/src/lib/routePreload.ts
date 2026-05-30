const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/dashboard/DashboardPage'),
  '/orders': () => import('@/pages/orders/OrdersPage'),
  '/orders/:id': () => import('@/pages/orders/OrderDetailPage'),
  '/shipping': () => import('@/pages/shipping/ShippingPage'),
  '/shipping/:id': () => import('@/pages/shipping/ShipmentDetailPage'),
  '/customers': () => import('@/pages/customers/CustomersPage'),
  '/customers/segments': () => import('@/pages/customers/CustomerSegmentsPage'),
  '/returns': () => import('@/pages/returns/ReturnsPage'),
  '/accounting': () => import('@/pages/accounting/AccountingOverviewPage'),
  '/invoices': () => import('@/pages/invoices/InvoicesPage'),
  '/listings': () => import('@/pages/listings/ListingsPage'),
  '/products': () => import('@/pages/products/ProductsPage'),
  '/products/import': () => import('@/pages/products/ProductImportPage'),
  '/product-matching': () => import('@/pages/products/ProductMatchingPage'),
  '/categories': () => import('@/pages/categories/CategoriesPage'),
  '/products/count': () => import('@/pages/stock/StockCountPage'),
  '/products/transfers': () => import('@/pages/stock/StockTransferPage'),
  '/pricing': () => import('@/pages/pricing/PricingPage'),
  '/pricing/analysis': () => import('@/pages/pricing/PriceAnalysisPage'),
  '/campaigns': () => import('@/pages/campaigns/CampaignsPage'),
  '/analytics': () => import('@/pages/analytics/AnalyticsPage'),
  '/connections': () => import('@/pages/connections/ConnectionsPage'),
  '/connections/erp/setup': () => import('@/pages/connections/ErpSetupWizardPage'),
  '/connections/erp': () => import('@/pages/connections/ErpConnectionDetailPage'),
  '/connections/detail': () => import('@/pages/connections/ConnectionDetailPage'),
  '/sync-logs': () => import('@/pages/sync-logs/SyncLogsPage'),
  '/sync/history': () => import('@/pages/sync/SyncHistoryPage'),
  '/sync/conflicts': () => import('@/pages/sync/ConflictsPage'),
  '/notifications': () => import('@/pages/notifications/NotificationsPage'),
  '/support': () => import('@/pages/support/SupportPage'),
  '/support/new': () => import('@/pages/support/SupportTicketPage'),
  '/support/help': () => import('@/pages/support/HelpArticlePage'),
  '/audit-logs': () => import('@/pages/audit/AuditLogPage'),
  '/reports': () => import('@/pages/reports/ReportsPage'),
  '/migration': () => import('@/pages/migration/MigrationPage'),
  '/migration/history': () => import('@/pages/migration/MigrationHistoryPage'),
  '/partner': () => import('@/pages/partner/PartnerLayout'),
  '/partner/clients': () => import('@/pages/partner/PartnerClientsPage'),
  '/partner/commission': () => import('@/pages/partner/CommissionPage'),
  '/partner/commission-report': () => import('@/pages/partner/CommissionPage'),
  '/partner/performance': () => import('@/pages/partner/PartnerPerformanceTab'),
  '/partner/onboarding': () => import('@/pages/partner/PartnerOnboardingTab'),
  '/partner/white-label': () => import('@/pages/partner/PartnerWhiteLabelTab'),
  '/settings/partners': () => import('@/pages/settings/PartnersDiscoveryPage'),
  '/settings': () => import('@/pages/settings/SettingsPage'),
  '/settings/notifications': () =>
    import('@/pages/settings/NotificationPreferencesPage'),
  '/settings/team': () => import('@/pages/settings/UsersPage'),
  '/settings/subscription': () => import('@/pages/settings/SubscriptionPage'),
  '/settings/webhooks': () => import('@/pages/settings/WebhooksPage'),
  '/suppliers': () => import('@/pages/suppliers/SuppliersPage'),
  '/purchase-orders': () => import('@/pages/suppliers/PurchaseOrdersPage'),
  '/admin': () => import('@/pages/admin/AdminLayout'),
  '/admin/audit-logs': () => import('@/pages/admin/AdminPlatformAuditPage'),
  '/admin/integrations': () => import('@/pages/admin/AdminIntegrationsPage'),
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
