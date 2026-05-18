import type { ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { PrivateRoute } from '@/components/PrivateRoute';
import { Toaster } from '@/components/ui/sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { queryClient } from '@/lib/queryClient';
import { AuditLogPage } from '@/pages/audit/AuditLogPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ConnectionsPage } from '@/pages/connections/ConnectionsPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { InviteAcceptPage } from '@/pages/InviteAcceptPage';
import { ListingsPage } from '@/pages/listings/ListingsPage';
import { MigrationPage } from '@/pages/migration/MigrationPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { PartnerPage } from '@/pages/partner/PartnerPage';
import { PricingPage } from '@/pages/pricing/PricingPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StockPage } from '@/pages/stock/StockPage';
import { SyncLogsPage } from '@/pages/sync-logs/SyncLogsPage';

export default function App(): ReactElement {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route element={<PrivateRoute />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/sync-logs" element={<SyncLogsPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/migration" element={<MigrationPage />} />
                <Route path="/partner" element={<PartnerPage />} />
                <Route path="/settings/subscription" element={<SettingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
