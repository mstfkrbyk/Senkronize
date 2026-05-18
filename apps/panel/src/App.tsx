import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { Toaster } from '@/components/ui/sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { queryClient } from '@/lib/queryClient';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminOrgDetailPage } from '@/pages/admin/AdminOrgDetailPage';
import { AdminOrgsPage } from '@/pages/admin/AdminOrgsPage';
import { AdminSubscriptionsPage } from '@/pages/admin/AdminSubscriptionsPage';
import { AuditLogPage } from '@/pages/audit/AuditLogPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ConnectionsPage } from '@/pages/connections/ConnectionsPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { InviteAcceptPage } from '@/pages/InviteAcceptPage';
import { ListingsPage } from '@/pages/listings/ListingsPage';
import { MigrationPage } from '@/pages/migration/MigrationPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { PartnerPage } from '@/pages/partner/PartnerPage';
import { PricingPage } from '@/pages/pricing/PricingPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { ProductImportPage } from '@/pages/products/ProductImportPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StockPage } from '@/pages/stock/StockPage';
import { SyncLogsPage } from '@/pages/sync-logs/SyncLogsPage';
import { useThemeStore } from '@/store/theme.store';

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
        <SystemThemeListener />
        <Toaster position="top-center" richColors closeButton />
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
                <Route path="organizations/:orgId" element={<AdminOrgDetailPage />} />
                <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              </Route>
              <Route element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/products/import" element={<ProductImportPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/sync-logs" element={<SyncLogsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/migration" element={<MigrationPage />} />
                <Route path="/partner" element={<PartnerPage />} />
                <Route path="/settings/subscription" element={<SettingsPage />} />
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
