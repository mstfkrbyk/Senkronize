import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Calculator,
  FileText,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Percent,
  Plug,
  ShoppingCart,
  UserCircle,
  Users,
} from 'lucide-react';

import {
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import { shouldUsePartnerMobileNav } from '@/lib/partner-nav-context';
import { hasOrgProductLine } from '@/lib/org-products';

export type MobileNavEntry =
  | {
      kind: 'link';
      path: string;
      search?: string;
      icon: LucideIcon;
      labelKey: string;
      end?: boolean;
    }
  | { kind: 'menu'; icon: LucideIcon; labelKey: string };

const MENU_ENTRY: MobileNavEntry = {
  kind: 'menu',
  icon: Menu,
  labelKey: 'nav.menu',
};

function productsShortcut(tab?: string): MobileNavEntry {
  return {
    kind: 'link',
    path: '/products',
    ...(tab ? { search: `?tab=${tab}` } : {}),
    icon: PackageSearch,
    labelKey: 'nav.products',
  };
}

function showsExternalErpBar(ctx: NavCatalogContext): boolean {
  const { orgProducts, accountingMode } = ctx;
  return (
    accountingMode === 'EXTERNAL_ERP' &&
    (hasOrgProductLine(orgProducts, 'ACCOUNTING') ||
      hasOrgProductLine(orgProducts, 'INTEGRATION'))
  );
}

function showsNativeAccountingBar(ctx: NavCatalogContext): boolean {
  return (
    hasOrgProductLine(ctx.orgProducts, 'ACCOUNTING') &&
    ctx.accountingMode === 'NATIVE'
  );
}

function showsPartnerPortalBar(ctx: NavCatalogContext): boolean {
  return shouldUsePartnerMobileNav(ctx.orgType, ctx.isImpersonating === true);
}

/** Kenar çubuğu gruplarıyla uyumlu mobil alt menü (en fazla 4 kısayol + Menü). */
export function buildMobileNavEntries(ctx: NavCatalogContext): MobileNavEntry[] {
  if (showsPartnerPortalBar(ctx)) {
    return [
      {
        kind: 'link',
        path: '/partner',
        icon: LayoutDashboard,
        labelKey: 'nav.partnerDashboard',
        end: true,
      },
      {
        kind: 'link',
        path: '/partner/clients',
        icon: Users,
        labelKey: 'nav.partnerClients',
      },
      {
        kind: 'link',
        path: '/partner/commission',
        icon: Percent,
        labelKey: 'nav.partnerCommission',
      },
      MENU_ENTRY,
    ];
  }

  const hasIntegration = hasOrgProductLine(ctx.orgProducts, 'INTEGRATION');

  if (showsExternalErpBar(ctx)) {
    const items: MobileNavEntry[] = [
      {
        kind: 'link',
        path: '/connections',
        icon: Plug,
        labelKey: 'nav.integrations',
      },
    ];
    if (hasIntegration) {
      items.push({
        kind: 'link',
        path: '/orders',
        icon: ShoppingCart,
        labelKey: 'nav.orders',
      });
    }
    items.push(MENU_ENTRY);
    return items;
  }

  if (showsNativeAccountingBar(ctx)) {
    if (hasIntegration) {
      const items: MobileNavEntry[] = [
        {
          kind: 'link',
          path: '/accounting',
          icon: Calculator,
          labelKey: 'nav.accountingOverview',
        },
      ];
      if (shouldPlaceStockInNativeAccounting(ctx)) {
        items.push(productsShortcut('status'));
      }
      items.push(
        {
          kind: 'link',
          path: '/dashboard',
          icon: LayoutDashboard,
          labelKey: 'nav.dashboard',
          end: true,
        },
        {
          kind: 'link',
          path: '/orders',
          icon: ShoppingCart,
          labelKey: 'nav.orders',
        },
        MENU_ENTRY,
      );
      return items;
    }

    const items: MobileNavEntry[] = [
      {
        kind: 'link',
        path: '/accounting',
        icon: Calculator,
        labelKey: 'nav.accountingOverview',
      },
      {
        kind: 'link',
        path: '/invoices',
        icon: FileText,
        labelKey: 'nav.invoices',
      },
      {
        kind: 'link',
        path: '/customers',
        icon: UserCircle,
        labelKey: 'nav.customers',
      },
    ];
    if (shouldPlaceStockInNativeAccounting(ctx)) {
      items.push(productsShortcut('status'));
    } else {
      items.push({
        kind: 'link',
        path: '/reports',
        icon: BarChart2,
        labelKey: 'nav.reports',
      });
    }
    items.push(MENU_ENTRY);
    return items;
  }

  if (hasIntegration) {
    const items: MobileNavEntry[] = [
      {
        kind: 'link',
        path: '/dashboard',
        icon: LayoutDashboard,
        labelKey: 'nav.dashboard',
        end: true,
      },
      {
        kind: 'link',
        path: '/orders',
        icon: ShoppingCart,
        labelKey: 'nav.orders',
      },
    ];
    if (shouldPlaceStockInEcommerce(ctx)) {
      items.push(productsShortcut('status'));
    } else {
      items.push(productsShortcut());
    }
    items.push(
      {
        kind: 'link',
        path: '/connections',
        icon: Plug,
        labelKey: 'nav.connections',
      },
      MENU_ENTRY,
    );
    return items;
  }

  return [MENU_ENTRY];
}

export const MOBILE_BOTTOM_NAV_GRID_COLS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};
