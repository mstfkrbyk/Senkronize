import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Activity,
  ArrowRightLeft,
  BarChart2,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  FolderTree,
  Handshake,
  History,
  LifeBuoy,
  Calculator,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Package,
  PackageSearch,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  UserCircle,
  Warehouse,
  Link2,
  ScanLine,
} from 'lucide-react';

export type NavGroupId =
  | 'ecommerce'
  | 'nativeAccounting'
  | 'externalErp'
  | 'common';

export interface NavItem {
  labelKey: string;
  /** Dinamik menü öğeleri için doğrudan etiket (i18n anahtarı yerine) */
  label?: string;
  icon: LucideIcon;
  path: string;
  /** Kenar çubuğu grubu — breadcrumb / üst çubuk */
  group?: NavGroupId;
  /** NavLink search (ör. ERP sekmesi) */
  search?: string;
  badge?: string;
  partnerOnly?: boolean;
  /** Yalnızca tam path eşleşmesi (ör. /stock üst sayfa, alt rotalar hariç) */
  matchExact?: boolean;
  /** Collapsible alt menü */
  children?: NavItem[];
  /** Yalnızca SUPER_ADMIN — sync geçmişi, log, manuel operasyon */
  integrationOpsOnly?: boolean;
}

function withGroup(items: NavItem[], group: NavGroupId): NavItem[] {
  return items.map((item) => ({
    ...item,
    group,
    children: item.children
      ? withGroup(item.children, group)
      : undefined,
  }));
}

/** Stok alt menüsü — tek "Stok" üst öğesi altında (grup üst öğeden gelir) */
export const STOCK_NAV_CHILDREN: NavItem[] = [
  {
    labelKey: 'nav.stockStatus',
    icon: Warehouse,
    path: '/stock',
    matchExact: true,
  },
  {
    labelKey: 'nav.stockWarehouses',
    icon: Building2,
    path: '/stock/warehouses',
  },
  {
    labelKey: 'nav.stockMovements',
    icon: History,
    path: '/stock/movements',
  },
  {
    labelKey: 'nav.stockTransfer',
    icon: ArrowRightLeft,
    path: '/stock/transfers',
  },
  {
    labelKey: 'nav.stockForecast',
    icon: LineChart,
    path: '/stock/forecast',
  },
  {
    labelKey: 'nav.stockCountBarcode',
    icon: ScanLine,
    path: '/stock/count',
  },
];

/** Stok üst menüsü (grup `withNavGroup` ile atanır) */
export const STOCK_NAV_ITEM: NavItem = {
  labelKey: 'nav.stock',
  icon: Warehouse,
  path: '/stock',
  children: STOCK_NAV_CHILDREN,
};

export function withNavGroup(item: NavItem, group: NavGroupId): NavItem {
  return {
    ...item,
    group,
    children: item.children
      ? item.children.map((child) => ({ ...child, group }))
      : undefined,
  };
}

/** E-ticaret entegrasyonu — pazaryeri (stok nav-match ile eklenir) */
export const ECOMMERCE_NAV_ITEMS: NavItem[] = withGroup([
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    labelKey: 'nav.orders',
    icon: ShoppingCart,
    path: '/orders',
    badge: 'canlı',
  },
  { labelKey: 'nav.returns', icon: Undo2, path: '/returns' },
  { labelKey: 'nav.shipping', icon: Truck, path: '/shipping' },
  { labelKey: 'nav.listings', icon: Package, path: '/listings' },
  { labelKey: 'nav.products', icon: PackageSearch, path: '/products' },
  { labelKey: 'nav.categories', icon: FolderTree, path: '/categories' },
  {
    labelKey: 'nav.productMatching',
    icon: Link2,
    path: '/product-matching',
    matchExact: true,
  },
  { labelKey: 'nav.pricing', icon: Tag, path: '/pricing', badge: 'PRO', matchExact: true },
  {
    labelKey: 'nav.priceAnalysis',
    icon: LineChart,
    path: '/pricing/analysis',
    badge: 'PRO',
  },
  { labelKey: 'nav.campaigns', icon: Megaphone, path: '/campaigns', badge: 'PRO' },
  { labelKey: 'nav.analytics', icon: BarChart3, path: '/analytics' },
  { labelKey: 'nav.migration', icon: ArrowRightLeft, path: '/migration' },
], 'ecommerce');

/** E-ticaret hattına özel: pazaryeri bağlantıları ve senkron */
export const INTEGRATION_SYNC_NAV_ITEMS: NavItem[] = withGroup([
  { labelKey: 'nav.integrations', icon: Plug, path: '/connections' },
  {
    labelKey: 'nav.syncLogs',
    icon: Activity,
    path: '/sync-logs',
    integrationOpsOnly: true,
  },
  {
    labelKey: 'nav.syncHistory',
    icon: History,
    path: '/sync/history',
    integrationOpsOnly: true,
  },
  {
    labelKey: 'nav.syncConflicts',
    icon: AlertTriangle,
    path: '/sync/conflicts',
    integrationOpsOnly: true,
  },
], 'ecommerce');

/** Müşteri (cari) — yalnızca entegrasyon hattında; muhasebe hattında native menüde */
export const ECOMMERCE_CUSTOMERS_NAV_ITEM: NavItem = {
  labelKey: 'nav.customers',
  icon: UserCircle,
  path: '/customers',
  group: 'ecommerce',
};

/** Yerel ön muhasebe */
export const NATIVE_ACCOUNTING_NAV_ITEMS: NavItem[] = withGroup([
  {
    labelKey: 'nav.accountingOverview',
    icon: Calculator,
    path: '/accounting',
  },
  { labelKey: 'nav.invoices', icon: FileText, path: '/invoices' },
  { labelKey: 'nav.customers', icon: UserCircle, path: '/customers' },
  { labelKey: 'nav.reports', icon: BarChart2, path: '/reports' },
  { labelKey: 'nav.suppliers', icon: Building2, path: '/suppliers' },
  {
    labelKey: 'nav.purchaseOrders',
    icon: ClipboardList,
    path: '/purchase-orders',
  },
], 'nativeAccounting');

/** Harici ERP modunda entegrasyon ve senkron (pazaryeri + ERP bağlantıları) */
export const EXTERNAL_ERP_NAV_ITEMS: NavItem[] = withGroup([
  {
    labelKey: 'nav.integrations',
    icon: Plug,
    path: '/connections',
  },
  {
    labelKey: 'nav.syncLogs',
    icon: Activity,
    path: '/sync-logs',
    integrationOpsOnly: true,
  },
  {
    labelKey: 'nav.syncHistory',
    icon: History,
    path: '/sync/history',
    integrationOpsOnly: true,
  },
  {
    labelKey: 'nav.syncConflicts',
    icon: AlertTriangle,
    path: '/sync/conflicts',
    integrationOpsOnly: true,
  },
], 'externalErp');

/**
 * @deprecated NATIVE_ACCOUNTING_NAV_ITEMS kullanın
 */
export const ACCOUNTING_NAV_ITEMS: NavItem[] = NATIVE_ACCOUNTING_NAV_ITEMS;

/** Partner org — müşteri paneli kenar çubuğu (yalnızca partner portalı) */
export const PARTNER_SIDEBAR_NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.partner', icon: Handshake, path: '/partner' },
];

/** Ortak — ayarlar, bildirimler, destek */
export const COMMON_NAV_ITEMS: NavItem[] = withGroup(
  [
    { labelKey: 'nav.notifications', icon: Bell, path: '/notifications' },
    { labelKey: 'nav.support', icon: LifeBuoy, path: '/support' },
    { labelKey: 'nav.auditLogs', icon: History, path: '/audit-logs' },
    { labelKey: 'nav.settings', icon: Settings, path: '/settings' },
  ],
  'common',
);

/** Üst çubuk başlığı — yaprak öğeler (grup üstleri hariç) */
export function flattenNavItemsForTitle(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.children?.length) {
      out.push(...flattenNavItemsForTitle(item.children));
    } else {
      out.push(item);
    }
  }
  return out;
}

/** Üst çubuk başlığı için tüm rotalar */
export const ALL_NAV_ITEMS_FOR_TITLE: NavItem[] = flattenNavItemsForTitle([
  ...ECOMMERCE_NAV_ITEMS,
  withNavGroup(STOCK_NAV_ITEM, 'ecommerce'),
  ECOMMERCE_CUSTOMERS_NAV_ITEM,
  ...INTEGRATION_SYNC_NAV_ITEMS,
  ...NATIVE_ACCOUNTING_NAV_ITEMS,
  withNavGroup(STOCK_NAV_ITEM, 'nativeAccounting'),
  ...EXTERNAL_ERP_NAV_ITEMS,
  ...COMMON_NAV_ITEMS,
]);
