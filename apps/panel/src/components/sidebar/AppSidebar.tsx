import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { SidebarNav } from '@/components/sidebar/SidebarNav';
import { SidebarUser } from '@/components/sidebar/SidebarUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useIsTablet } from '@/hooks/use-mobile';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';

function CollapseToggle(): ReactElement {
  const { t } = useTranslation();
  const { toggleSidebar, state } = useSidebar();
  const expanded = state === 'expanded';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={() => toggleSidebar()}
    >
      {expanded ? (
        <>
          <ChevronLeft className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">{t('nav.collapse')}</span>
        </>
      ) : (
        <>
          <ChevronRight className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">{t('nav.expand')}</span>
        </>
      )}
    </Button>
  );
}

export function AppSidebar(): ReactElement {
  const isTablet = useIsTablet();
  const { setOpen } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      onMouseEnter={() => {
        if (isTablet) {
          setOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (isTablet) {
          setOpen(false);
        }
      }}
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuButton size="lg" asChild>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-semibold text-sidebar-foreground"
            >
              <Zap className="size-5 shrink-0 text-sky-400" />
              <span className="truncate text-lg tracking-tight group-data-[collapsible=icon]:hidden">
                Senkronize
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border p-2">
        <SidebarUser />
        <SidebarSeparator className="bg-sidebar-border" />
        <CollapseToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
