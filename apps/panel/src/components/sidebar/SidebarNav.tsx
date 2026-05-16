import type { ReactElement } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { NAV_ITEMS } from '@/constants/navigation';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/auth.store';

export function SidebarNav(): ReactElement {
  const location = useLocation();
  const orgType = useAuthStore((s) => s.currentOrg?.type);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.partnerOnly || orgType === 'PARTNER',
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
        Menü
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' &&
                location.pathname.startsWith(`${item.path}/`));

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                >
                  <NavLink to={item.path}>
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge === 'canlı' ? (
                      <SidebarMenuBadge className="bg-accent text-accent-foreground">
                        canlı
                      </SidebarMenuBadge>
                    ) : null}
                    {item.badge === 'PRO' ? (
                      <SidebarMenuBadge className="bg-sidebar-primary/20 text-[10px] font-semibold uppercase text-sidebar-primary-foreground">
                        PRO
                      </SidebarMenuBadge>
                    ) : null}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
