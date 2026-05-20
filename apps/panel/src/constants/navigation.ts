import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Activity,
  ArrowRightLeft,
  BarChart2,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  FolderTree,
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
  Users2,
  Warehouse,
  Link2,
  ScanLine,
} from 'lucide-react';

export interface NavItem {
  labelKey: string;
  icon: LucideIcon;
  path: string;
  /** NavLink search (ör. ERP sekmesi) */
  search?: string;
  badge?: string;
  partnerOnly?: boolean;
  /** Yalnızca tam path eşleşmesi (ör. /stock üst sayfa, alt rotalar hariç) */
  matchExact?: boolean;
  /** Collapsible alt menü */
  children?: NavItem[];
}

/** Stok alt menüsü — tek "Stok" üst öğesi altında */
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

/** E-ticaret entegrasyonu — pazaryeri / stok (bağlantı ve sync ayrı grupta) */
export const ECOMMERCE_NAV_ITEMS: NavItem[] = [
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
  },
  {
    labelKey: 'nav.stock',
    icon: Warehouse,
    path: '/stock',
    children: STOCK_NAV_CHILDREN,
  },
  { labelKey: 'nav.pricing', icon: Tag, path: '/pricing', badge: 'PRO' },
  { labelKey: 'nav.campaigns', icon: Megaphone, path: '/campaigns', badge: 'PRO' },
  { labelKey: 'nav.migration', icon: ArrowRightLeft, path: '/migration' },
];

/** E-ticaret hattına özel: pazaryeri bağlantıları ve senkron */
export const INTEGRATION_SYNC_NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.integrations', icon: Plug, path: '/connections' },
  { labelKey: 'nav.syncLogs', icon: Activity, path: '/sync-logs' },
  { labelKey: 'nav.syncHistory', icon: History, path: '/sync/history' },
  { labelKey: 'nav.syncConflicts', icon: AlertTriangle, path: '/sync/conflicts' },
];

/** Müşteri (cari) — yalnızca entegrasyon hattında; muhasebe hattında native menüde */
export const ECOMMERCE_CUSTOMERS_NAV_ITEM: NavItem = {
  labelKey: 'nav.customers',
  icon: UserCircle,
  path: '/customers',
};

/** Yerel ön muhasebe */
export const NATIVE_ACCOUNTING_NAV_ITEMS: NavItem[] = [
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
];

/** Harici ERP (Paraşüt, BizimHesap, Logo…) */
export const EXTERNAL_ERP_NAV_ITEMS: NavItem[] = [
  {
    labelKey: 'nav.erpConnections',
    icon: Plug,
    path: '/connections',
    search: '?tab=erp',
  },
  { labelKey: 'nav.syncLogs', icon: Activity, path: '/sync-logs' },
  { labelKey: 'nav.syncHistory', icon: History, path: '/sync/history' },
  { labelKey: 'nav.syncConflicts', icon: AlertTriangle, path: '/sync/conflicts' },
];

/**
 * @deprecated NATIVE_ACCOUNTING_NAV_ITEMS kullanın
 */
export const ACCOUNTING_NAV_ITEMS: NavItem[] = NATIVE_ACCOUNTING_NAV_ITEMS;

/** Ortak — ayarlar, bildirimler, destek */
export const COMMON_NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.notifications', icon: Bell, path: '/notifications' },
  { labelKey: 'nav.support', icon: LifeBuoy, path: '/support' },
  { labelKey: 'nav.auditLogs', icon: History, path: '/audit-logs' },
  {
    labelKey: 'nav.partner',
    icon: Users2,
    path: '/partner',
    partnerOnly: true,
  },
  { labelKey: 'nav.settings', icon: Settings, path: '/settings' },
];

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
  ECOMMERCE_CUSTOMERS_NAV_ITEM,
  ...INTEGRATION_SYNC_NAV_ITEMS,
  ...NATIVE_ACCOUNTING_NAV_ITEMS,
  ...EXTERNAL_ERP_NAV_ITEMS,
  ...COMMON_NAV_ITEMS,
]);
