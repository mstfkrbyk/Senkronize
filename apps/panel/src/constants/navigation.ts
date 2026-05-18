import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  Bell,
  Building2,
  ClipboardList,
  History,
  LayoutDashboard,
  LineChart,
  Package,
  PackageSearch,
  ScanLine,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Undo2,
  Users2,
  Warehouse,
} from 'lucide-react';

export interface NavItem {
  labelKey: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  partnerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    labelKey: 'nav.orders',
    icon: ShoppingCart,
    path: '/orders',
    badge: 'canlı',
  },
  { labelKey: 'nav.returns', icon: Undo2, path: '/returns' },
  { labelKey: 'nav.listings', icon: Package, path: '/listings' },
  { labelKey: 'nav.products', icon: PackageSearch, path: '/products' },
  { labelKey: 'nav.stock', icon: Warehouse, path: '/stock' },
  { labelKey: 'nav.stockForecast', icon: LineChart, path: '/stock/forecast' },
  { labelKey: 'nav.stockCount', icon: ScanLine, path: '/stock/count' },
  { labelKey: 'nav.pricing', icon: Tag, path: '/pricing', badge: 'PRO' },
  { labelKey: 'nav.integrations', icon: Plug, path: '/connections' },
  { labelKey: 'nav.syncLogs', icon: Activity, path: '/sync-logs' },
  { labelKey: 'nav.notifications', icon: Bell, path: '/notifications' },
  { labelKey: 'nav.auditLogs', icon: History, path: '/audit-logs' },
  { labelKey: 'nav.reports', icon: BarChart2, path: '/reports' },
  { labelKey: 'nav.migration', icon: ArrowRightLeft, path: '/migration' },
  {
    labelKey: 'nav.partner',
    icon: Users2,
    path: '/partner',
    partnerOnly: true,
  },
  { labelKey: 'nav.settings', icon: Settings, path: '/settings' },
];

export const SUPPLY_NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.suppliers', icon: Building2, path: '/suppliers' },
  {
    labelKey: 'nav.purchaseOrders',
    icon: ClipboardList,
    path: '/purchase-orders',
  },
];

/** Üst çubuk başlığı için tüm rotalar */
export const ALL_NAV_ITEMS_FOR_TITLE: NavItem[] = [
  ...NAV_ITEMS,
  ...SUPPLY_NAV_ITEMS,
];
