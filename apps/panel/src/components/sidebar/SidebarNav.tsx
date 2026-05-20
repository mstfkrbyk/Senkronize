import type { ReactElement } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { BarChart3 } from 'lucide-react';

import {
  ACCOUNTING_NAV_ITEMS,
  COMMON_NAV_ITEMS,
  ECOMMERCE_NAV_ITEMS,
  type NavItem,
} from '@/constants/navigation';
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

const NAV_TOUR_ATTR: Partial<Record<string, string>> = {
  '/connections': 'sidebar-connections',
  '/products': 'sidebar-products',
  '/orders': 'sidebar-orders',
  '/pricing': 'sidebar-pricing',
};

function filterVisible(items: NavItem[], orgType: string | undefined): NavItem[] {
  return items.filter(
    (item) => !item.partnerOnly || orgType === 'PARTNER',
  );
}

interface NavGroupProps {
  labelKey?: string;
  items: NavItem[];
  location: ReturnType<typeof useLocation>;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  t: (key: string) => string;
}

function NavGroup({
  labelKey,
  items,
  location,
  isMobile,
  setOpenMobile,
  t,
}: NavGroupProps): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      {labelKey ? (
        <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t(labelKey)}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
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
                    data-tour={NAV_TOUR_ATTR[item.path]}
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
  );
}

export function SidebarNav(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const userRole = useAuthStore((s) => s.user?.role);
  const { isMobile, setOpenMobile } = useSidebar();

  const ecommerceItems = filterVisible(ECOMMERCE_NAV_ITEMS, orgType);
  const accountingItems = filterVisible(ACCOUNTING_NAV_ITEMS, orgType);
  const commonItems = filterVisible(COMMON_NAV_ITEMS, orgType);

  const groupProps = {
    location,
    isMobile,
    setOpenMobile,
    t,
  };

  return (
    <>
      <NavGroup
        labelKey="nav.ecommerce"
        items={ecommerceItems}
        {...groupProps}
      />
      <NavGroup
        labelKey="nav.accounting"
        items={accountingItems}
        {...groupProps}
      />
      <NavGroup items={commonItems} {...groupProps} />

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
