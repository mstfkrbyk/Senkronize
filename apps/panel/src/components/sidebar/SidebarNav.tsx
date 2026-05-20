import type { ReactElement } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { BarChart3 } from 'lucide-react';

import { NAV_ITEMS, SUPPLY_NAV_ITEMS } from '@/constants/navigation';
import { prefetchRoute } from '@/lib/routePreload';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/auth.store';

export function SidebarNav(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const userRole = useAuthStore((s) => s.user?.role);
  const { isMobile, setOpenMobile } = useSidebar();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.partnerOnly || orgType === 'PARTNER',
  );

  const visibleSupply = SUPPLY_NAV_ITEMS.filter(
    (item) => !item.partnerOnly || orgType === 'PARTNER',
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('nav.menu')}
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
                    tooltip={t(item.labelKey)}
                  >
                    <NavLink
                      to={item.path}
                      data-onboarding={item.path}
                      onMouseEnter={() => {
                        prefetchRoute(item.path);
                      }}
                      onFocus={() => {
                        prefetchRoute(item.path);
                      }}
                      onClick={() => {
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                      {item.badge === 'canlı' ? (
                        <SidebarMenuBadge className="bg-accent text-accent-foreground">
                          {t('nav.live')}
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

      <SidebarGroup>
        <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('nav.supply')}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleSupply.map((item) => {
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
                    tooltip={t(item.labelKey)}
                  >
                    <NavLink
                      to={item.path}
                      onMouseEnter={() => {
                        prefetchRoute(item.path);
                      }}
                      onFocus={() => {
                        prefetchRoute(item.path);
                      }}
                      onClick={() => {
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupContent>
        {userRole === 'SUPER_ADMIN' ? (
          <>
            <SidebarSeparator className="my-2 bg-sidebar-border" />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t('nav.adminPanel')}>
                  <Link
                    to="/admin"
                    onMouseEnter={() => {
                      prefetchRoute('/admin');
                    }}
                    onFocus={() => {
                      prefetchRoute('/admin');
                    }}
                    onClick={() => {
                      if (isMobile) {
                        setOpenMobile(false);
                      }
                    }}
                  >
                    <BarChart3 className="size-4 shrink-0" />
                    <span className="truncate">{t('nav.adminPanel')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : null}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
