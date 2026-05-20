import type { ReactElement } from 'react';
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSentryUser } from '@/hooks/useSentryUser';
import { PageLoader } from '@/components/PageLoader';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { Toaster } from '@/components/ui/sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { queryClient } from '@/lib/queryClient';
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/auth/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
);

const InviteAcceptPage = lazy(() =>
  import('@/pages/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage })),
);
const AcceptInvitePage = lazy(() =>
  import('@/pages/auth/AcceptInvitePage').then((m) => ({
    default: m.AcceptInvitePage,
  })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const OfflinePage = lazy(() =>
  import('@/pages/OfflinePage').then((m) => ({ default: m.OfflinePage })),
);
const OnboardingPage = lazy(() =>
  import('@/pages/onboarding/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
);
const AdminLayout = lazy(() =>
  import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminOrgsPage = lazy(() =>
  import('@/pages/admin/AdminOrgsPage').then((m) => ({ default: m.AdminOrgsPage })),
);
const AdminOrgDetailPage = lazy(() =>
  import('@/pages/admin/AdminOrgDetailPage').then((m) => ({
    default: m.AdminOrgDetailPage,
  })),
);
const AdminSubscriptionsPage = lazy(() =>
  import('@/pages/admin/AdminSubscriptionsPage').then((m) => ({
    default: m.AdminSubscriptionsPage,
  })),
);
const AdminTicketsPage = lazy(() =>
  import('@/pages/admin/AdminTicketsPage').then((m) => ({
    default: m.AdminTicketsPage,
  })),
);
const SupportPage = lazy(() =>
  import('@/pages/support/SupportPage').then((m) => ({ default: m.SupportPage })),
);
const SupportTicketPage = lazy(() =>
  import('@/pages/support/SupportTicketPage').then((m) => ({
    default: m.SupportTicketPage,
  })),
);
const AuditLogPage = lazy(() =>
  import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);
const CategoriesPage = lazy(() =>
  import('@/pages/categories/CategoriesPage').then((m) => ({
    default: m.CategoriesPage,
  })),
);
const ConnectionsPage = lazy(() =>
  import('@/pages/connections/ConnectionsPage').then((m) => ({
    default: m.ConnectionsPage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const ListingsPage = lazy(() =>
  import('@/pages/listings/ListingsPage').then((m) => ({ default: m.ListingsPage })),
);
const MigrationPage = lazy(() =>
  import('@/pages/migration/MigrationPage').then((m) => ({
    default: m.MigrationPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const OrdersPage = lazy(() =>
  import('@/pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const ReturnsPage = lazy(() =>
  import('@/pages/returns/ReturnsPage').then((m) => ({ default: m.ReturnsPage })),
);
const CustomersPage = lazy(() =>
  import('@/pages/customers/CustomersPage').then((m) => ({
    default: m.CustomersPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import('@/pages/customers/CustomerDetailPage').then((m) => ({
    default: m.CustomerDetailPage,
  })),
);
const CustomerSegmentsPage = lazy(() =>
  import('@/pages/customers/CustomerSegmentsPage').then((m) => ({
    default: m.CustomerSegmentsPage,
  })),
);
const PartnerPage = lazy(() =>
  import('@/pages/partner/PartnerPage').then((m) => ({ default: m.PartnerPage })),
);
const CampaignsPage = lazy(() =>
  import('@/pages/campaigns/CampaignsPage').then((m) => ({
    default: m.CampaignsPage,
  })),
);
const PricingPage = lazy(() =>
  import('@/pages/pricing/PricingPage').then((m) => ({ default: m.PricingPage })),
);
const ProductDetailPage = lazy(() =>
  import('@/pages/products/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const ProductImportPage = lazy(() =>
  import('@/pages/products/ProductImportPage').then((m) => ({
    default: m.ProductImportPage,
  })),
);
const ProductMatchingPage = lazy(() =>
  import('@/pages/products/ProductMatchingPage').then((m) => ({
    default: m.ProductMatchingPage,
  })),
);
const ProductsPage = lazy(() =>
  import('@/pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/pages/analytics/AnalyticsPage').then((m) => ({
    default: m.AnalyticsPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const PaymentCallbackPage = lazy(() =>
  import('@/pages/payment/PaymentCallbackPage').then((m) => ({
    default: m.PaymentCallbackPage,
  })),
);
const PaymentSuccessPage = lazy(() =>
  import('@/pages/payment/PaymentSuccessPage').then((m) => ({
    default: m.PaymentSuccessPage,
  })),
);
const PaymentFailurePage = lazy(() =>
  import('@/pages/payment/PaymentFailurePage').then((m) => ({
    default: m.PaymentFailurePage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/settings/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const WebhooksPage = lazy(() =>
  import('@/pages/settings/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
);
const WebhookDetailPage = lazy(() =>
  import('@/pages/settings/WebhookDetailPage').then((m) => ({
    default: m.WebhookDetailPage,
  })),
);
const StockCountPage = lazy(() =>
  import('@/pages/stock/StockCountPage').then((m) => ({
    default: m.StockCountPage,
  })),
);
const StockTransferPage = lazy(() =>
  import('@/pages/stock/StockTransferPage').then((m) => ({
    default: m.StockTransferPage,
  })),
);
const StockManagementPage = lazy(() =>
  import('@/pages/stock/StockManagementPage').then((m) => ({
    default: m.StockManagementPage,
  })),
);
const StockForecastPage = lazy(() =>
  import('@/pages/stock/StockForecastPage').then((m) => ({
    default: m.StockForecastPage,
  })),
);
const SyncLogsPage = lazy(() =>
  import('@/pages/sync-logs/SyncLogsPage').then((m) => ({ default: m.SyncLogsPage })),
);
const ConflictsPage = lazy(() =>
  import('@/pages/sync/ConflictsPage').then((m) => ({ default: m.ConflictsPage })),
);
const SuppliersPage = lazy(() =>
  import('@/pages/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);
const SupplierDetailPage = lazy(() =>
  import('@/pages/suppliers/SupplierDetailPage').then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const PurchaseOrdersPage = lazy(() =>
  import('@/pages/suppliers/PurchaseOrdersPage').then((m) => ({
    default: m.PurchaseOrdersPage,
  })),
);
const PurchaseOrderDetailPage = lazy(() =>
  import('@/pages/suppliers/PurchaseOrderDetailPage').then((m) => ({
    default: m.PurchaseOrderDetailPage,
  })),
);

function SentryUserSync(): null {
  useSentryUser();
  return null;
}

function AnalyticsSync(): null {
  useAnalytics();
  return null;
}

export default function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SentryUserSync />
        <AnalyticsSync />
        <Toaster position="top-center" richColors closeButton />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/offline" element={<OfflinePage />} />
            <Route
              path="/accept-invite"
              element={
                <ErrorBoundary>
                  <AcceptInvitePage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/invite/:token"
              element={
                <ErrorBoundary>
                  <InviteAcceptPage />
                </ErrorBoundary>
              }
            />
            <Route
              element={
                <ErrorBoundary>
                  <AuthLayout />
                </ErrorBoundary>
              }
            >
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route
              element={
                <ErrorBoundary>
                  <PrivateRoute />
                </ErrorBoundary>
              }
            >
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/payment/callback" element={<PaymentCallbackPage />} />
              <Route path="/payment/success" element={<PaymentSuccessPage />} />
              <Route path="/payment/failure" element={<PaymentFailurePage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/admin"
                element={
                  <SuperAdminRoute>
                    <AdminLayout />
                  </SuperAdminRoute>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="organizations" element={<AdminOrgsPage />} />
                <Route
                  path="organizations/:orgId"
                  element={<AdminOrgDetailPage />}
                />
                <Route
                  path="subscriptions"
                  element={<AdminSubscriptionsPage />}
                />
                <Route path="tickets" element={<AdminTicketsPage />} />
              </Route>
              <Route element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/customers/segments" element={<CustomerSegmentsPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/returns" element={<ReturnsPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/products/import" element={<ProductImportPage />} />
                <Route path="/product-matching" element={<ProductMatchingPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/stock/count" element={<StockCountPage />} />
                <Route path="/stock/transfers/:id" element={<StockTransferPage />} />
                <Route path="/stock/transfers" element={<StockTransferPage />} />
                <Route path="/stock/forecast" element={<StockForecastPage />} />
                <Route path="/stock" element={<StockManagementPage />} />
                <Route path="/suppliers/:supplierId" element={<SupplierDetailPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
                <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/sync-logs" element={<SyncLogsPage />} />
                <Route path="/sync/conflicts" element={<ConflictsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/support/:id" element={<SupportTicketPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/migration" element={<MigrationPage />} />
                <Route path="/partner" element={<PartnerPage />} />
                <Route
                  path="/settings/subscription"
                  element={<SettingsPage />}
                />
                <Route path="/settings/profile" element={<ProfilePage />} />
                <Route path="/settings/webhooks/:id" element={<WebhookDetailPage />} />
                <Route path="/settings/webhooks" element={<WebhooksPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <ErrorBoundary>
                  <NotFoundPage />
                </ErrorBoundary>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
