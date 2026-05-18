import type { ReactElement } from 'react';
import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSentryUser } from '@/hooks/useSentryUser';
import { PageLoader } from '@/components/PageLoader';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { Toaster } from '@/components/ui/sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { queryClient } from '@/lib/queryClient';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { useThemeStore } from '@/store/theme.store';

const InviteAcceptPage = lazy(() =>
  import('@/pages/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
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
const AuditLogPage = lazy(() =>
  import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
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
const PartnerPage = lazy(() =>
  import('@/pages/partner/PartnerPage').then((m) => ({ default: m.PartnerPage })),
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
const ProductsPage = lazy(() =>
  import('@/pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const StockManagementPage = lazy(() =>
  import('@/pages/stock/StockManagementPage').then((m) => ({
    default: m.StockManagementPage,
  })),
);
const SyncLogsPage = lazy(() =>
  import('@/pages/sync-logs/SyncLogsPage').then((m) => ({ default: m.SyncLogsPage })),
);

function SentryUserSync(): null {
  useSentryUser();
  return null;
}

function SystemThemeListener(): null {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (): void => {
      if (useThemeStore.getState().theme === 'system') {
        document.documentElement.classList.toggle('dark', mq.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return null;
}

export default function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SentryUserSync />
        <SystemThemeListener />
        <Toaster position="top-center" richColors closeButton />
        <Suspense fallback={<PageLoader />}>
          <Routes>
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
              </Route>
              <Route element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/products/import" element={<ProductImportPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/stock" element={<StockManagementPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/sync-logs" element={<SyncLogsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/migration" element={<MigrationPage />} />
                <Route path="/partner" element={<PartnerPage />} />
                <Route
                  path="/settings/subscription"
                  element={<SettingsPage />}
                />
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
