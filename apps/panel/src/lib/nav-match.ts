import { PackageSearch } from 'lucide-react';

import {
  COMMON_NAV_ITEMS,
  PARTNER_SIDEBAR_NAV_ITEMS,
  ECOMMERCE_CUSTOMERS_NAV_ITEM,
  ECOMMERCE_NAV_ITEMS,
  EXTERNAL_ERP_NAV_ITEMS,
  INTEGRATION_SYNC_NAV_ITEMS,
  NATIVE_ACCOUNTING_NAV_ITEMS,
  withNavGroup,
  type NavGroupId,
  type NavItem,
} from '@/constants/navigation';
import type { AccountingMode } from '@/lib/accounting-mode';
import {
  hasOrgProductLine,
  isAccountingOnlyOrg,
  isIntegrationOnlyOrg,
} from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export const NAV_GROUP_LABEL_KEYS: Record<NavGroupId, string> = {
  ecommerce: 'nav.ecommerce',
  nativeAccounting: 'nav.nativeAccounting',
  externalErp: 'nav.externalErp',
  common: 'nav.common',
};

export interface NavCatalogContext {
  orgType?: string;
  orgProducts?: OrgProductLine[];
  accountingMode: AccountingMode;
  /** Partner müşteri paneline geçtiğinde müşteri kataloğu kullanılır. */
  isImpersonating?: boolean;
  /** SUPER_ADMIN — sync log / geçmiş / çakışma menüleri */
  canViewIntegrationOps?: boolean;
}

/** E-ticaret menüsünde stok (pazaryeri senkronu) */
export function shouldPlaceStockInEcommerce(ctx: NavCatalogContext): boolean {
  if (!hasOrgProductLine(ctx.orgProducts, 'INTEGRATION')) {
    return false;
  }
  if (isIntegrationOnlyOrg(ctx.orgProducts)) {
    return true;
  }
  if (
    hasOrgProductLine(ctx.orgProducts, 'ACCOUNTING') &&
    ctx.accountingMode === 'NATIVE'
  ) {
    return false;
  }
  return true;
}

/** Ön muhasebe menüsünde stok (yerel envanter) */
export function shouldPlaceStockInNativeAccounting(
  ctx: NavCatalogContext,
): boolean {
  if (!hasOrgProductLine(ctx.orgProducts, 'ACCOUNTING')) {
    return false;
  }
  if (isAccountingOnlyOrg(ctx.orgProducts)) {
    return true;
  }
  return ctx.accountingMode === 'NATIVE';
}

const NATIVE_PRODUCTS_INDEX = NATIVE_ACCOUNTING_NAV_ITEMS.length;

const NATIVE_PRODUCTS_NAV_ITEM: NavItem = {
  labelKey: 'nav.products',
  icon: PackageSearch,
  path: '/products',
  search: '?tab=status',
};

function insertNativeProductsNavItem(items: NavItem[]): NavItem[] {
  const next = [...items];
  next.splice(
    NATIVE_PRODUCTS_INDEX,
    0,
    withNavGroup(NATIVE_PRODUCTS_NAV_ITEM, 'nativeAccounting'),
  );
  return next;
}

function filterVisible(
  items: NavItem[],
  orgType: string | undefined,
  canViewIntegrationOps: boolean,
): NavItem[] {
  return items.filter((item) => {
    if (item.partnerOnly && orgType !== 'PARTNER') {
      return false;
    }
    if (item.integrationOpsOnly && !canViewIntegrationOps) {
      return false;
    }
    return true;
  });
}

export function buildEcommerceNavItems(ctx: NavCatalogContext): NavItem[] {
  const { orgType, orgProducts, accountingMode } = ctx;
  const canOps = ctx.canViewIntegrationOps === true;

  if (orgType === 'PARTNER' || !hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    return [];
  }

  let items: NavItem[] = [...ECOMMERCE_NAV_ITEMS];
  if (!hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    items.splice(4, 0, ECOMMERCE_CUSTOMERS_NAV_ITEM);
  }
  const showIntegrationSyncInEcommerce =
    hasOrgProductLine(orgProducts, 'INTEGRATION') &&
    accountingMode !== 'EXTERNAL_ERP';
  if (showIntegrationSyncInEcommerce) {
    items.push(...INTEGRATION_SYNC_NAV_ITEMS);
  }
  return filterVisible(items, orgType, canOps);
}

function shouldShowNativeAccountingNav(ctx: NavCatalogContext): boolean {
  if (!hasOrgProductLine(ctx.orgProducts, 'ACCOUNTING')) {
    return false;
  }
  return (
    ctx.accountingMode === 'NATIVE' || isAccountingOnlyOrg(ctx.orgProducts)
  );
}

export function buildNativeAccountingNavItems(
  ctx: NavCatalogContext,
): NavItem[] {
  const { orgType } = ctx;
  const canOps = ctx.canViewIntegrationOps === true;
  if (orgType === 'PARTNER' || !shouldShowNativeAccountingNav(ctx)) {
    return [];
  }
  let items = [...NATIVE_ACCOUNTING_NAV_ITEMS];
  if (
    shouldPlaceStockInNativeAccounting(ctx) &&
    !hasOrgProductLine(ctx.orgProducts, 'INTEGRATION')
  ) {
    items = insertNativeProductsNavItem(items);
  }
  return filterVisible(items, orgType, canOps);
}

export function buildExternalErpNavItems(ctx: NavCatalogContext): NavItem[] {
  const { orgType, orgProducts, accountingMode } = ctx;
  const canOps = ctx.canViewIntegrationOps === true;
  const showExternalErp =
    accountingMode === 'EXTERNAL_ERP' &&
    (hasOrgProductLine(orgProducts, 'ACCOUNTING') ||
      hasOrgProductLine(orgProducts, 'INTEGRATION'));
  if (orgType === 'PARTNER' || !showExternalErp) {
    return [];
  }
  return filterVisible(EXTERNAL_ERP_NAV_ITEMS, orgType, canOps);
}

export interface SidebarNavSections {
  ecommerce: NavItem[];
  nativeAccounting: NavItem[];
  externalErp: NavItem[];
  common: NavItem[];
}

export function buildSidebarNavSections(ctx: NavCatalogContext): SidebarNavSections {
  const canOps = ctx.canViewIntegrationOps === true;
  if (ctx.orgType === 'PARTNER') {
    return {
      ecommerce: [],
      nativeAccounting: [],
      externalErp: [],
      common: filterVisible(PARTNER_SIDEBAR_NAV_ITEMS, ctx.orgType, canOps),
    };
  }
  return {
    ecommerce: buildEcommerceNavItems(ctx),
    nativeAccounting: buildNativeAccountingNavItems(ctx),
    externalErp: buildExternalErpNavItems(ctx),
    common: filterVisible(COMMON_NAV_ITEMS, ctx.orgType, canOps),
  };
}

/** Ortak menü — üst bağlam / aktif rota (partner kenar çubuğunda ayrı gösterilir) */
function commonNavItemsForContext(ctx: NavCatalogContext): NavItem[] {
  return filterVisible(COMMON_NAV_ITEMS, ctx.orgType, ctx.canViewIntegrationOps === true);
}

/** Kenar çubuğunda görünen öğeler — SidebarNav ile aynı sıra */
export function buildVisibleNavCatalog(ctx: NavCatalogContext): NavItem[] {
  const sections = buildSidebarNavSections(ctx);
  const shared = commonNavItemsForContext(ctx);
  if (ctx.orgType === 'PARTNER') {
    return [...sections.common, ...shared];
  }
  return [
    ...sections.ecommerce,
    ...sections.nativeAccounting,
    ...sections.externalErp,
    ...sections.common,
  ];
}

/** Alt menüler dahil yaprak + üst öğeler */
export function flattenNavCatalog(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.children?.length) {
      out.push(item);
      out.push(...flattenNavCatalog(item.children));
    } else {
      out.push(item);
    }
  }
  return out;
}

function pathMatchesItem(pathname: string, item: NavItem): boolean {
  if (item.matchExact) {
    return pathname === item.path;
  }
  if (pathname === item.path) {
    return true;
  }
  // /product-matching — /products alt rotası değil
  if (item.path === '/products' && pathname.startsWith('/product-')) {
    return false;
  }
  return item.path !== '/' && pathname.startsWith(`${item.path}/`);
}

function searchMatchesItem(search: string, item: NavItem): boolean {
  if (!item.search) {
    return true;
  }
  return search === item.search || search.startsWith(`${item.search}&`);
}

/**
 * Görünür katalogdan en uzun path eşleşmesi.
 * Aynı path için `search` tanımlı öğe, sorgu dizesi eşleşiyorsa önceliklidir.
 */
export function findActiveNavItem(
  pathname: string,
  search: string,
  catalog: NavItem[],
): NavItem | undefined {
  const flat = flattenNavCatalog(catalog);
  let best: NavItem | undefined;
  let bestLen = -1;

  for (const item of flat) {
    if (!pathMatchesItem(pathname, item)) {
      continue;
    }
    if (!searchMatchesItem(search, item)) {
      continue;
    }
    const len = item.path.length;
    if (len > bestLen) {
      best = item;
      bestLen = len;
    } else if (len === bestLen) {
      if (item.matchExact && !best?.matchExact) {
        best = item;
      } else if (item.search && searchMatchesItem(search, item)) {
        best = item;
      }
    }
  }

  return best;
}
