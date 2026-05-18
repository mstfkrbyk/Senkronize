import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  Bell,
  History,
  LayoutDashboard,
  Package,
  PackageSearch,
  ScanLine,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
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
  { labelKey: 'nav.listings', icon: Package, path: '/listings' },
  { labelKey: 'nav.products', icon: PackageSearch, path: '/products' },
  { labelKey: 'nav.stock', icon: Warehouse, path: '/stock' },
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
