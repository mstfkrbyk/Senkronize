import type { ReactElement } from 'react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { BarcodeInputProvider } from '@/hooks/useBarcodeInput';
import { CommandPalette } from '@/components/CommandPalette';
import { QuickStockAdjust } from '@/components/QuickStockAdjust';
import { QuickStockSearch } from '@/components/QuickStockSearch';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { GlobalSyncMonitor } from '@/components/connections/GlobalSyncMonitor';
import { PageTransition } from '@/components/PageTransition';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { BreadcrumbProvider } from '@/contexts/breadcrumb.context';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { PushNotificationBanner } from '@/components/notifications/PushNotificationBanner';
import { DemoBanner } from '@/components/DemoBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { CurrencyWidget } from '@/components/CurrencyWidget';
import { OnboardingTour } from '@/components/OnboardingTour';
import { TopBar } from '@/components/topbar/TopBar';
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSocket } from '@/hooks/useSocket';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

function MobileSidebarGestures(): null {
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();

  const closeSidebar = useCallback((): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  const openSidebar = useCallback((): void => {
    if (isMobile) {
      setOpenMobile(true);
    }
  }, [isMobile, setOpenMobile]);

  useSwipeGesture(closeSidebar, openSidebar);

  return null;
}

export function DashboardLayout(): ReactElement {
  useKeyboardShortcuts();
  useSocket();
  const { data: me } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const [tabletExpanded, setTabletExpanded] = useState(false);

  useEffect(() => {
    if (!isTablet) {
      setTabletExpanded(false);
    }
  }, [isTablet]);

  useEffect(() => {
    if (!me) {
      return;
    }
    setUser({
      id: me.user.id,
      email: me.user.email,
      name: me.user.name,
      role: me.user.role,
    });
    setOrg({
      id: me.organization.id,
      name: me.organization.name,
      slug: me.organization.slug,
      type: me.organization.type,
      onboardingCompleted: me.organization.onboardingCompleted,
      plan: me.organization.plan,
      orgProducts: me.organization.orgProducts,
      accountingMode: me.organization.accountingMode,
    });
  }, [me, setOrg, setUser]);

  const sidebarOpen = isTablet ? tabletExpanded : !sidebarCollapsed;

  const handleSidebarOpenChange = (open: boolean): void => {
    if (isTablet) {
      setTabletExpanded(open);
      return;
    }
    if (!isMobile) {
      setSidebarCollapsed(!open);
    }
  };

  return (
    <BarcodeInputProvider>
      <BreadcrumbProvider>
        <Fragment>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            İçeriğe Atla
          </a>
          <SidebarProvider
            open={sidebarOpen}
            onOpenChange={handleSidebarOpenChange}
            defaultOpen={!isMobile && !isTablet}
          >
            <MobileSidebarGestures />
            <AppSidebar />
            <SidebarInset className="flex max-h-svh flex-col overflow-hidden">
              <DemoBanner />
              <ImpersonationBanner />
              <PushNotificationBanner />
              <TopBar />
              <main
                id="main-content"
                tabIndex={-1}
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 pb-20 outline-none md:p-6 md:pb-6"
              >
                <Breadcrumb />
                <GlobalSyncMonitor />
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </main>
              <MobileBottomNav />
            </SidebarInset>
          </SidebarProvider>
          <KeyboardShortcutsModal />
          <CommandPalette />
          <QuickStockAdjust />
          <QuickStockSearch />
          <OnboardingTour />
          <CurrencyWidget />
        </Fragment>
      </BreadcrumbProvider>
    </BarcodeInputProvider>
  );
}
