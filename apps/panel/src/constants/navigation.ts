import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  LayoutDashboard,
  Package,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Warehouse,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Özet', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Siparişler', icon: ShoppingCart, path: '/orders', badge: 'canlı' },
  { label: 'Ürün Listesi', icon: Package, path: '/listings' },
  { label: 'Stok', icon: Warehouse, path: '/stock' },
  { label: 'Fiyatlandırma', icon: Tag, path: '/pricing', badge: 'PRO' },
  { label: 'Entegrasyonlar', icon: Plug, path: '/connections' },
  { label: 'Raporlar', icon: BarChart2, path: '/reports' },
  { label: 'Ayarlar', icon: Settings, path: '/settings' },
];
