import type { ReactElement } from 'react';
import { lazy, Suspense } from 'react';
import posthog from 'posthog-js';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AppErrorBoundary, ErrorBoundary } from '@/components/ErrorBoundary';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSentryUser } from '@/hooks/useSentryUser';
import { PageLoader } from '@/components/PageLoader';
import {
  ProductAwareDashboardGate,
  ProductAwareHomeRedirect,
} from '@/components/ProductAwareHomeRedirect';
import {
  accountingRoute,
  integrationRoute,
  productsHubRoute,
  stockRoute,
} from '@/components/ProductLineRoute';
import { IntegrationOpsRoute } from '@/components/IntegrationOpsRoute';
import { CustomerAppGuard } from '@/components/CustomerAppGuard';
import { PartnerRoute } from '@/components/PartnerRoute';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { Toaster } from '@/components/ui/sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { queryClient } from '@/lib/queryClient';

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.debug();
      }
    },
  });
}

const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/auth/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
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
const OnboardingWizardPage = lazy(() =>
  import('@/pages/onboarding/OnboardingWizardPage').then((m) => ({
    default: m.OnboardingWizardPage,
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
const AdminPartnersPage = lazy(() =>
  import('@/pages/admin/AdminPartnersPage').then((m) => ({
    default: m.AdminPartnersPage,
  })),
);
const AdminPartnerLinksPage = lazy(() =>
  import('@/pages/admin/AdminPartnerLinksPage').then((m) => ({
    default: m.AdminPartnerLinksPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({
    default: m.AdminUsersPage,
  })),
);
const AdminUserDetailPage = lazy(() =>
  import('@/pages/admin/AdminUserDetailPage').then((m) => ({
    default: m.AdminUserDetailPage,
  })),
);
const AdminPlatformAuditPage = lazy(() =>
  import('@/pages/admin/AdminPlatformAuditPage').then((m) => ({
    default: m.AdminPlatformAuditPage,
  })),
);
const AdminSecurityPage = lazy(() =>
  import('@/pages/admin/AdminSecurityPage').then((m) => ({ default: m.AdminSecurityPage })),
);
const AdminIntegrationsPage = lazy(() =>
  import('@/pages/admin/AdminIntegrationsPage').then((m) => ({
    default: m.AdminIntegrationsPage,
  })),
);
const AdminIntegrationDetailPage = lazy(() =>
  import('@/pages/admin/AdminIntegrationDetailPage').then((m) => ({
    default: m.AdminIntegrationDetailPage,
  })),
);
const PartnersDiscoveryPage = lazy(() =>
  import('@/pages/settings/PartnersDiscoveryPage').then((m) => ({
    default: m.PartnersDiscoveryPage,
  })),
);
const SupportPage = lazy(() =>
  import('@/pages/support/SupportPage').then((m) => ({ default: m.SupportPage })),
);
const TicketDetailPage = lazy(() =>
  import('@/pages/support/TicketDetailPage').then((m) => ({
    default: m.TicketDetailPage,
  })),
);
const HelpArticlePage = lazy(() =>
  import('@/pages/support/HelpArticlePage').then((m) => ({
    default: m.HelpArticlePage,
  })),
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
const ConnectionDetailPage = lazy(() =>
  import('@/pages/connections/ConnectionDetailPage').then((m) => ({
    default: m.ConnectionDetailPage,
  })),
);
const ErpConnectionDetailPage = lazy(() =>
  import('@/pages/connections/ErpConnectionDetailPage').then((m) => ({
    default: m.ErpConnectionDetailPage,
  })),
);
const ErpSetupWizardPage = lazy(() =>
  import('@/pages/connections/ErpSetupWizardPage').then((m) => ({
    default: m.ErpSetupWizardPage,
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
const ListingDetailPage = lazy(() =>
  import('@/pages/listings/ListingDetailPage').then((m) => ({
    default: m.ListingDetailPage,
  })),
);
const MigrationPage = lazy(() =>
  import('@/pages/migration/MigrationPage').then((m) => ({
    default: m.MigrationPage,
  })),
);
const MigrationHistoryPage = lazy(() =>
  import('@/pages/migration/MigrationHistoryPage').then((m) => ({
    default: m.MigrationHistoryPage,
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
const OrderDetailPage = lazy(() =>
  import('@/pages/orders/OrderDetailPage').then((m) => ({
    default: m.OrderDetailPage,
  })),
);
const ReturnsPage = lazy(() =>
  import('@/pages/returns/ReturnsPage').then((m) => ({ default: m.ReturnsPage })),
);
const AccountingOverviewPage = lazy(() =>
  import('@/pages/accounting/AccountingOverviewPage').then((m) => ({
    default: m.AccountingOverviewPage,
  })),
);
const InvoicesPage = lazy(() =>
  import('@/pages/invoices/InvoicesPage').then((m) => ({
    default: m.InvoicesPage,
  })),
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
const PartnerLayout = lazy(() =>
  import('@/pages/partner/PartnerLayout').then((m) => ({
    default: m.PartnerLayout,
  })),
);
const PartnerDashboardPage = lazy(() =>
  import('@/pages/partner/PartnerDashboardPage').then((m) => ({
    default: m.PartnerDashboardPage,
  })),
);
const PartnerClientsPage = lazy(() =>
  import('@/pages/partner/PartnerClientsPage').then((m) => ({
    default: m.PartnerClientsPage,
  })),
);
const CommissionPage = lazy(() =>
  import('@/pages/partner/CommissionPage').then((m) => ({
    default: m.CommissionPage,
  })),
);
const PartnerOnboardingTab = lazy(() =>
  import('@/pages/partner/PartnerOnboardingTab').then((m) => ({
    default: m.PartnerOnboardingTab,
  })),
);
const PartnerWhiteLabelTab = lazy(() =>
  import('@/pages/partner/PartnerWhiteLabelTab').then((m) => ({
    default: m.PartnerWhiteLabelTab,
  })),
);
const PartnerPerformanceTab = lazy(() =>
  import('@/pages/partner/PartnerPerformanceTab').then((m) => ({
    default: m.PartnerPerformanceTab,
  })),
);
const CampaignsPage = lazy(() =>
  import('@/pages/campaigns/CampaignsPage').then((m) => ({
    default: m.CampaignsPage,
  })),
);
const PricingPage = lazy(() =>
  import('@/pages/pricing/PricingPage').then((m) => ({ default: m.PricingPage })),
);
const PriceAnalysisPage = lazy(() =>
  import('@/pages/pricing/PriceAnalysisPage').then((m) => ({
    default: m.PriceAnalysisPage,
  })),
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
const SettingsLayout = lazy(() =>
  import('@/layouts/SettingsLayout').then((m) => ({ default: m.SettingsLayout })),
);
const OrganizationSettingsPage = lazy(() =>
  import('@/pages/settings/OrganizationSettingsPage').then((m) => ({
    default: m.OrganizationSettingsPage,
  })),
);
const AppearanceSettingsPage = lazy(() =>
  import('@/pages/settings/AppearanceSettingsPage').then((m) => ({
    default: m.AppearanceSettingsPage,
  })),
);
const ApiKeysSettingsPage = lazy(() =>
  import('@/pages/settings/ApiKeysSettingsPage').then((m) => ({
    default: m.ApiKeysSettingsPage,
  })),
);
const AccountingModeSettingsPage = lazy(() =>
  import('@/pages/settings/AccountingModeSettingsPage').then((m) => ({
    default: m.AccountingModeSettingsPage,
  })),
);
const CurrencySettingsPage = lazy(() =>
  import('@/pages/settings/CurrencySettingsPage').then((m) => ({
    default: m.CurrencySettingsPage,
  })),
);
const InvoiceNumberingSettingsPage = lazy(() =>
  import('@/pages/settings/InvoiceNumberingSettingsPage').then((m) => ({
    default: m.InvoiceNumberingSettingsPage,
  })),
);
const ErpSyncSettingsPage = lazy(() =>
  import('@/pages/settings/ErpSyncSettingsPage').then((m) => ({
    default: m.ErpSyncSettingsPage,
  })),
);
const ProductMatchingSettingsPage = lazy(() =>
  import('@/pages/settings/ProductMatchingSettingsPage').then((m) => ({
    default: m.ProductMatchingSettingsPage,
  })),
);
const SecurityPage = lazy(() =>
  import('@/pages/settings/SecurityPage').then((m) => ({ default: m.SecurityPage })),
);
const SubscriptionPage = lazy(() =>
  import('@/pages/settings/SubscriptionPage').then((m) => ({
    default: m.SubscriptionPage,
  })),
);
const PaymentPage = lazy(() =>
  import('@/pages/payment/PaymentPage').then((m) => ({
    default: m.PaymentPage,
  })),
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
const NotificationPreferencesPage = lazy(() =>
  import('@/pages/settings/NotificationPreferencesPage').then((m) => ({
    default: m.NotificationPreferencesPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/pages/settings/UsersPage').then((m) => ({ default: m.UsersPage })),
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
const StockLegacyRedirect = lazy(() =>
  import('@/pages/products/StockLegacyRedirect').then((m) => ({
    default: m.StockLegacyRedirect,
  })),
);
const StockCountScanPage = lazy(() =>
  import('@/pages/stock/StockCountScanPage').then((m) => ({
    default: m.StockCountScanPage,
  })),
);
const SyncLogsPage = lazy(() =>
  import('@/pages/sync-logs/SyncLogsPage').then((m) => ({ default: m.SyncLogsPage })),
);
const ConflictsPage = lazy(() =>
  import('@/pages/sync/ConflictsPage').then((m) => ({ default: m.ConflictsPage })),
);
const SyncHistoryPage = lazy(() =>
  import('@/pages/sync/SyncHistoryPage').then((m) => ({
    default: m.SyncHistoryPage,
  })),
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
const ShippingPage = lazy(() =>
  import('@/pages/shipping/ShippingPage').then((m) => ({
    default: m.ShippingPage,
  })),
);
const ShipmentDetailPage = lazy(() =>
  import('@/pages/shipping/ShipmentDetailPage').then((m) => ({
    default: m.ShipmentDetailPage,
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
    <AppErrorBoundary>
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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Route>
            <Route
              element={
                <ErrorBoundary>
                  <PrivateRoute />
                </ErrorBoundary>
              }
            >
              <Route path="/onboarding" element={<OnboardingPage />}>
                <Route path="wizard" element={<OnboardingWizardPage />} />
              </Route>
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/payment/callback" element={<PaymentCallbackPage />} />
              <Route path="/payment/success" element={<PaymentSuccessPage />} />
              <Route path="/payment/failure" element={<PaymentFailurePage />} />
              <Route path="/" element={<ProductAwareHomeRedirect />} />
              <Route
                path="/admin"
                element={
                  <SuperAdminRoute>
                    <AdminLayout />
                  </SuperAdminRoute>
                }
              >
                <Route
                  index
                  element={
                    <ErrorBoundary>
                      <AdminDashboardPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="organizations"
                  element={
                    <ErrorBoundary>
                      <AdminOrgsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="organizations/:orgId"
                  element={
                    <ErrorBoundary>
                      <AdminOrgDetailPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="users/:id"
                  element={
                    <ErrorBoundary>
                      <AdminUserDetailPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="users"
                  element={
                    <ErrorBoundary>
                      <AdminUsersPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="subscriptions"
                  element={
                    <ErrorBoundary>
                      <AdminSubscriptionsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="tickets"
                  element={
                    <ErrorBoundary>
                      <AdminTicketsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="partners"
                  element={
                    <ErrorBoundary>
                      <AdminPartnersPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="partner-link-requests"
                  element={
                    <ErrorBoundary>
                      <AdminPartnerLinksPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="audit-logs"
                  element={
                    <ErrorBoundary>
                      <AdminPlatformAuditPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="integrations"
                  element={
                    <ErrorBoundary>
                      <AdminIntegrationsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="integrations/:platformKey"
                  element={
                    <ErrorBoundary>
                      <AdminIntegrationDetailPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="security"
                  element={
                    <ErrorBoundary>
                      <AdminSecurityPage />
                    </ErrorBoundary>
                  }
                />
              </Route>
              <Route
                path="/partner"
                element={
                  <PartnerRoute>
                    <PartnerLayout />
                  </PartnerRoute>
                }
              >
                <Route
                  index
                  element={
                    <ErrorBoundary>
                      <PartnerDashboardPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="clients"
                  element={
                    <ErrorBoundary>
                      <PartnerClientsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="commission"
                  element={
                    <ErrorBoundary>
                      <CommissionPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="commission-report"
                  element={
                    <ErrorBoundary>
                      <CommissionPage initialTab="rapor" />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="performance"
                  element={
                    <ErrorBoundary>
                      <PartnerPerformanceTab />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="onboarding"
                  element={
                    <ErrorBoundary>
                      <PartnerOnboardingTab />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="white-label"
                  element={
                    <ErrorBoundary>
                      <PartnerWhiteLabelTab />
                    </ErrorBoundary>
                  }
                />
              </Route>
              <Route element={<CustomerAppGuard />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<ProductAwareHomeRedirect />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProductAwareDashboardGate>
                      <DashboardPage />
                    </ProductAwareDashboardGate>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={integrationRoute(<OrderDetailPage />)}
                />
                <Route
                  path="/orders"
                  element={integrationRoute(<OrdersPage />)}
                />
                <Route
                  path="/shipping/:id"
                  element={integrationRoute(<ShipmentDetailPage />, {
                    fallback: 'redirect',
                  })}
                />
                <Route
                  path="/shipping"
                  element={integrationRoute(<ShippingPage />, {
                    fallback: 'redirect',
                  })}
                />
                <Route path="/customers/segments" element={<CustomerSegmentsPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route
                  path="/returns"
                  element={integrationRoute(<ReturnsPage />)}
                />
                <Route
                  path="/accounting/overview"
                  element={accountingRoute(<AccountingOverviewPage />)}
                />
                <Route
                  path="/accounting"
                  element={accountingRoute(<AccountingOverviewPage />)}
                />
                <Route
                  path="/invoices"
                  element={accountingRoute(<InvoicesPage />)}
                />
                <Route
                  path="/listings/:id"
                  element={integrationRoute(<ListingDetailPage />)}
                />
                <Route
                  path="/listings"
                  element={integrationRoute(<ListingsPage />)}
                />
                <Route
                  path="/products/import"
                  element={integrationRoute(<ProductImportPage />)}
                />
                <Route
                  path="/product-matching"
                  element={integrationRoute(<ProductMatchingPage />)}
                />
                <Route
                  path="/products/:id"
                  element={integrationRoute(<ProductDetailPage />)}
                />
                <Route
                  path="/products"
                  element={productsHubRoute(<ProductsPage />)}
                />
                <Route
                  path="/products/count/scan"
                  element={stockRoute(<StockCountScanPage />)}
                />
                <Route
                  path="/products/count"
                  element={stockRoute(<StockCountPage />)}
                />
                <Route
                  path="/products/transfers/:id"
                  element={stockRoute(<StockTransferPage />)}
                />
                <Route
                  path="/products/transfers"
                  element={stockRoute(<StockTransferPage />)}
                />
                <Route
                  path="/stock/*"
                  element={stockRoute(<StockLegacyRedirect />)}
                />
                <Route
                  path="/categories"
                  element={integrationRoute(<CategoriesPage />)}
                />
                <Route
                  path="/suppliers/:id"
                  element={accountingRoute(<SupplierDetailPage />)}
                />
                <Route
                  path="/suppliers"
                  element={accountingRoute(<SuppliersPage />)}
                />
                <Route
                  path="/purchase-orders/:id"
                  element={accountingRoute(<PurchaseOrderDetailPage />)}
                />
                <Route
                  path="/purchase-orders"
                  element={accountingRoute(<PurchaseOrdersPage />)}
                />
                <Route
                  path="/pricing/analysis"
                  element={integrationRoute(<PriceAnalysisPage />, {
                    fallback: 'redirect',
                  })}
                />
                <Route
                  path="/pricing"
                  element={integrationRoute(<PricingPage />, {
                    fallback: 'redirect',
                  })}
                />
                <Route
                  path="/campaigns"
                  element={integrationRoute(<CampaignsPage />)}
                />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route
                  path="/connections/erp/setup"
                  element={<ErpSetupWizardPage />}
                />
                <Route
                  path="/connections/erp/:id"
                  element={
                    <ErrorBoundary>
                      <ErpConnectionDetailPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/connections/:id"
                  element={
                    <ErrorBoundary>
                      <ConnectionDetailPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/sync-logs"
                  element={integrationRoute(
                    <IntegrationOpsRoute>
                      <SyncLogsPage />
                    </IntegrationOpsRoute>,
                  )}
                />
                <Route
                  path="/sync/history"
                  element={integrationRoute(
                    <IntegrationOpsRoute>
                      <SyncHistoryPage />
                    </IntegrationOpsRoute>,
                  )}
                />
                <Route
                  path="/sync/conflicts"
                  element={integrationRoute(
                    <IntegrationOpsRoute>
                      <ConflictsPage />
                    </IntegrationOpsRoute>,
                  )}
                />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/support/help/:slug" element={<HelpArticlePage />} />
                <Route path="/support/new" element={<SupportTicketPage />} />
                <Route path="/support/:id" element={<TicketDetailPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route
                  path="/audit"
                  element={<Navigate to="/audit-logs" replace />}
                />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route
                  path="/analytics"
                  element={integrationRoute(<AnalyticsPage />)}
                />
                <Route path="/reports" element={<ReportsPage />} />
                <Route
                  path="/migration/history"
                  element={integrationRoute(<MigrationHistoryPage />)}
                />
                <Route
                  path="/migration"
                  element={integrationRoute(<MigrationPage />)}
                />
                <Route element={<SettingsLayout />}>
                  <Route
                    path="/settings"
                    element={<Navigate to="/settings/organization" replace />}
                  />
                  <Route path="/settings/profile" element={<ProfilePage />} />
                  <Route
                    path="/settings/organization"
                    element={<OrganizationSettingsPage />}
                  />
                  <Route path="/settings/security" element={<SecurityPage />} />
                  <Route
                    path="/settings/notifications"
                    element={<NotificationPreferencesPage />}
                  />
                  <Route
                    path="/settings/appearance"
                    element={<AppearanceSettingsPage />}
                  />
                  <Route path="/settings/team" element={<UsersPage />} />
                  <Route
                    path="/settings/subscription"
                    element={<SubscriptionPage />}
                  />
                  <Route
                    path="/settings/partners"
                    element={<PartnersDiscoveryPage />}
                  />
                  <Route path="/settings/api-keys" element={<ApiKeysSettingsPage />} />
                  <Route
                    path="/settings/webhooks/:id"
                    element={<WebhookDetailPage />}
                  />
                  <Route path="/settings/webhooks" element={<WebhooksPage />} />
                  <Route
                    path="/settings/accounting-mode"
                    element={<AccountingModeSettingsPage />}
                  />
                  <Route path="/settings/currency" element={<CurrencySettingsPage />} />
                  <Route
                    path="/settings/invoice-numbering"
                    element={<InvoiceNumberingSettingsPage />}
                  />
                  <Route path="/settings/erp-sync" element={<ErpSyncSettingsPage />} />
                  <Route
                    path="/settings/product-matching"
                    element={<ProductMatchingSettingsPage />}
                  />
                </Route>
              </Route>
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
    </AppErrorBoundary>
  );
}
