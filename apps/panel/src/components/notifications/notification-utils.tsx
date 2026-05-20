import type { ReactElement } from 'react';
import {
  AlertTriangle,
  Bell,
  CreditCard,
  FileText,
  Package,
  RefreshCw,
  Settings,
  Shield,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { InAppNotificationType } from '@/store/notifications.store';

export type NotificationVisualCategory = 'order' | 'stock' | 'error' | 'system';

export function visualCategoryForType(
  type: InAppNotificationType,
): NotificationVisualCategory {
  if (
    type === 'ORDER_NEW' ||
    type === 'ORDER_STATUS_CHANGED' ||
    type === 'PRICE_UPDATED' ||
    type === 'BUYBOX_WON' ||
    type === 'BUYBOX_LOST'
  ) {
    return 'order';
  }
  if (type === 'STOCK_LOW' || type === 'STOCK_OUT') {
    return 'stock';
  }
  if (
    type === 'SYNC_ERROR' ||
    type === 'PAYMENT_FAILED' ||
    type === 'SUBSCRIPTION_EXPIRING'
  ) {
    return 'error';
  }
  return 'system';
}

export function categoryLabel(category: NotificationVisualCategory): string {
  switch (category) {
    case 'order':
      return 'Sipariş';
    case 'stock':
      return 'Stok';
    case 'error':
      return 'Hata';
    default:
      return 'Sistem';
  }
}

export function categoryStyles(category: NotificationVisualCategory): {
  iconBg: string;
  iconText: string;
  unreadBorder: string;
} {
  switch (category) {
    case 'order':
      return {
        iconBg: 'bg-sky-100 dark:bg-sky-950',
        iconText: 'text-sky-600 dark:text-sky-400',
        unreadBorder: 'border-l-sky-500 bg-sky-50/50 dark:bg-sky-950/30',
      };
    case 'stock':
      return {
        iconBg: 'bg-orange-100 dark:bg-orange-950',
        iconText: 'text-orange-600 dark:text-orange-400',
        unreadBorder: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/30',
      };
    case 'error':
      return {
        iconBg: 'bg-red-100 dark:bg-red-950',
        iconText: 'text-red-600 dark:text-red-400',
        unreadBorder: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/30',
      };
    default:
      return {
        iconBg: 'bg-slate-100 dark:bg-slate-800',
        iconText: 'text-slate-600 dark:text-slate-400',
        unreadBorder: 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-900/40',
      };
  }
}

export function CategoryIcon({
  category,
  className,
}: {
  category: NotificationVisualCategory;
  className?: string;
}): ReactElement {
  const cnBase = cn('size-4 shrink-0', className);
  switch (category) {
    case 'order':
      return <ShoppingCart className={cnBase} aria-hidden />;
    case 'stock':
      return <Package className={cnBase} aria-hidden />;
    case 'error':
      return <AlertTriangle className={cnBase} aria-hidden />;
    default:
      return <Settings className={cnBase} aria-hidden />;
  }
}

export function preferenceCategoryIcon(id: string): ReactElement {
  const cnBase = 'size-4 shrink-0 text-sky-500';
  switch (id) {
    case 'orders':
      return <ShoppingCart className={cnBase} aria-hidden />;
    case 'stock':
      return <Package className={cnBase} aria-hidden />;
    case 'pricing':
      return <TrendingDown className={cnBase} aria-hidden />;
    case 'sync':
      return <RefreshCw className={cnBase} aria-hidden />;
    case 'security':
      return <Shield className={cnBase} aria-hidden />;
    case 'billing':
      return <CreditCard className={cnBase} aria-hidden />;
    case 'digest':
      return <FileText className={cnBase} aria-hidden />;
    default:
      return <Bell className={cnBase} aria-hidden />;
  }
}
