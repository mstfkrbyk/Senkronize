import type { ReactElement } from 'react';
import { Fragment, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { BarcodeInputProvider } from '@/hooks/useBarcodeInput';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BreadcrumbProvider } from '@/contexts/breadcrumb.context';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { DemoBanner } from '@/components/DemoBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { CurrencyWidget } from '@/components/CurrencyWidget';
import { OnboardingTour } from '@/components/OnboardingTour';
import { TopBar } from '@/components/topbar/TopBar';
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

export function DashboardLayout(): ReactElement {
  useKeyboardShortcuts();
  useSocket();
  const { data: me } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

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
    });
  }, [me, setOrg, setUser]);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

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
        open={!sidebarCollapsed}
        onOpenChange={(open) => setSidebarCollapsed(!open)}
      >
        <AppSidebar />
        <SidebarInset className="flex max-h-svh flex-col overflow-hidden">
          <DemoBanner />
          <ImpersonationBanner />
          <TopBar />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 outline-none md:p-6"
          >
            <Breadcrumb />
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <KeyboardShortcutsModal />
      <CommandPalette />
      <OnboardingTour />
      <CurrencyWidget />
    </Fragment>
      </BreadcrumbProvider>
    </BarcodeInputProvider>
  );
}
