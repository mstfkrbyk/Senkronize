import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { TopBar } from '@/components/topbar/TopBar';
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

export function DashboardLayout(): ReactElement {
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
      onboardingCompleted: me.organization.onboardingCompleted,
    });
  }, [me, setOrg, setUser]);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  return (
    <SidebarProvider
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsed(!open)}
    >
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
