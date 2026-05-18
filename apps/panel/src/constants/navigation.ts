import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  LayoutDashboard,
  Package,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Users2,
  Warehouse,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  partnerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Özet', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Siparişler', icon: ShoppingCart, path: '/orders', badge: 'canlı' },
  { label: 'Ürün Listesi', icon: Package, path: '/listings' },
  { label: 'Stok', icon: Warehouse, path: '/stock' },
  { label: 'Fiyatlandırma', icon: Tag, path: '/pricing', badge: 'PRO' },
  { label: 'Entegrasyonlar', icon: Plug, path: '/connections' },
  { label: 'Sync Durumu', icon: Activity, path: '/sync-logs' },
  { label: 'Raporlar', icon: BarChart2, path: '/reports' },
  { label: 'Geçiş sihirbazı', icon: ArrowRightLeft, path: '/migration' },
  {
    label: 'Partner Paneli',
    icon: Users2,
    path: '/partner',
    partnerOnly: true,
  },
  { label: 'Ayarlar', icon: Settings, path: '/settings' },
];
