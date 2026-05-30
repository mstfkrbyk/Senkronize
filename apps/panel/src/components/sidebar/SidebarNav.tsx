import { useMemo, type ReactElement } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { BarChart3 } from 'lucide-react';

import { CollapsibleNavGroup } from '@/components/sidebar/CollapsibleNavGroup';
import { NavGroupLabelWithHint } from '@/components/sidebar/NavGroupLabelWithHint';
import { PARTNER_SIDEBAR_NAV_ITEMS, type NavItem } from '@/constants/navigation';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { injectListingsNavChildren } from '@/lib/listings-nav';
import { prefetchRoute } from '@/lib/routePreload';
import { resolveNavGroupHintKey } from '@/lib/nav-group-hints';
import { buildSidebarNavSections } from '@/lib/nav-match';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useIntegrationOpsAccess } from '@/hooks/useIntegrationOpsAccess';
import { useAuthStore } from '@/store/auth.store';
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

const NAV_TOUR_ATTR: Partial<Record<string, string>> = {
  '/connections': 'sidebar-connections',
  '/products': 'sidebar-products',
  '/stock': 'sidebar-stock',
  '/orders': 'sidebar-orders',
  '/pricing': 'sidebar-pricing',
  '/pricing/analysis': 'sidebar-price-analysis',
};

function navItemTo(navItem: NavItem): string | { pathname: string; search?: string } {
  if (navItem.search) {
    return { pathname: navItem.path, search: navItem.search };
  }
  return navItem.path;
}

function isNavItemActive(
  item: NavItem,
  pathname: string,
  search: string,
): boolean {
  const pathMatch =
    pathname === item.path ||
    (!item.matchExact &&
      item.path !== '/' &&
      !(item.path === '/products' && pathname.startsWith('/product-')) &&
      pathname.startsWith(`${item.path}/`));
  if (!pathMatch) {
    return false;
  }
  if (!item.search) {
    return true;
  }
  return search === item.search || search.startsWith(`${item.search}&`);
}

function isNavGroupActive(
  item: NavItem,
  pathname: string,
  search: string,
): boolean {
  if (item.children?.length) {
    return item.children.some((child) =>
      isNavItemActive(child, pathname, search),
    );
  }
  return isNavItemActive(item, pathname, search);
}

interface NavGroupProps {
  labelKey?: string;
  hintKey?: string;
  items: NavItem[];
  location: ReturnType<typeof useLocation>;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  t: (key: string) => string;
}

function NavGroup({
  labelKey,
  hintKey,
  items,
  location,
  isMobile,
  setOpenMobile,
  t,
}: NavGroupProps): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  const isChildActive = (child: NavItem): boolean =>
    isNavItemActive(child, location.pathname, location.search);

  return (
    <SidebarGroup>
      {labelKey && hintKey ? (
        <NavGroupLabelWithHint label={t(labelKey)} hint={t(hintKey)} />
      ) : labelKey ? (
        <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t(labelKey)}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.children?.length) {
              return (
                <CollapsibleNavGroup
                  key={`${item.path}${item.search ?? ''}-group`}
                  item={item}
                  isActive={isNavGroupActive(
                    item,
                    location.pathname,
                    location.search,
                  )}
                  isChildActive={isChildActive}
                  navItemTo={navItemTo}
                  t={t}
                  isMobile={isMobile}
                  setOpenMobile={setOpenMobile}
                />
              );
            }

            const Icon = item.icon;
            const isActive = isNavItemActive(
              item,
              location.pathname,
              location.search,
            );

            return (
              <SidebarMenuItem key={`${item.path}${item.search ?? ''}`}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={t(item.labelKey)}
                >
                  <NavLink
                    to={navItemTo(item)}
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
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const userRole = useAuthStore((s) => s.user?.role);
  const { isMobile, setOpenMobile } = useSidebar();
  const { mode: accountingMode } = useAccountingMode();
  const canViewIntegrationOps = useIntegrationOpsAccess();
  const connectionsQuery = useMarketplaceConnections();

  const sections = buildSidebarNavSections({
    orgType,
    orgProducts,
    accountingMode,
    canViewIntegrationOps,
  });
  const ecommerceNavItems = useMemo(() => {
    const activePlatforms = (connectionsQuery.data ?? [])
      .filter((c) => c.isActive)
      .map((c) => c.platform);
    return injectListingsNavChildren(sections.ecommerce, activePlatforms);
  }, [connectionsQuery.data, sections.ecommerce]);
  const isPartnerOrg = orgType === 'PARTNER';

  const groupProps = {
    location,
    isMobile,
    setOpenMobile,
    t,
  };

  if (isPartnerOrg) {
    return (
      <>
        <NavGroup items={PARTNER_SIDEBAR_NAV_ITEMS} {...groupProps} />
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

  return (
    <>
      <NavGroup
        labelKey="nav.ecommerce"
        hintKey={resolveNavGroupHintKey('ecommerce', accountingMode)}
        items={ecommerceNavItems}
        {...groupProps}
      />
      <NavGroup
        labelKey="nav.nativeAccounting"
        hintKey={resolveNavGroupHintKey('nativeAccounting', accountingMode)}
        items={sections.nativeAccounting}
        {...groupProps}
      />
      <NavGroup
        labelKey="nav.externalErp"
        hintKey={resolveNavGroupHintKey('externalErp', accountingMode)}
        items={sections.externalErp}
        {...groupProps}
      />
      <NavGroup labelKey="nav.common" items={sections.common} {...groupProps} />

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
