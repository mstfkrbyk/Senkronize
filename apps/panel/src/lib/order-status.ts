import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle,
  FileText,
  Package,
  RotateCcw,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';

import type { OrderStatus } from '@/types/order';

export type OrderStatusColor =
  | 'blue'
  | 'indigo'
  | 'yellow'
  | 'purple'
  | 'green'
  | 'red'
  | 'orange';

export interface OrderStatusConfigEntry {
  label: string;
  color: OrderStatusColor;
  icon: LucideIcon;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfigEntry> = {
  NEW: { label: 'Yeni', color: 'blue', icon: ShoppingCart },
  PICKING: { label: 'Hazırlanıyor', color: 'yellow', icon: Package },
  INVOICED: { label: 'Faturalandı', color: 'indigo', icon: FileText },
  SHIPPED: { label: 'Kargoda', color: 'purple', icon: Truck },
  DELIVERED: { label: 'Teslim Edildi', color: 'green', icon: CheckCircle },
  CANCELLED: { label: 'İptal', color: 'red', icon: XCircle },
  RETURNED: { label: 'İade', color: 'orange', icon: RotateCcw },
};

/** @deprecated ORDER_STATUS_CONFIG.label kullanın */
export const ORDER_STATUS_LABEL_TR: Record<OrderStatus, string> = {
  NEW: ORDER_STATUS_CONFIG.NEW.label,
  PICKING: ORDER_STATUS_CONFIG.PICKING.label,
  INVOICED: ORDER_STATUS_CONFIG.INVOICED.label,
  SHIPPED: ORDER_STATUS_CONFIG.SHIPPED.label,
  DELIVERED: ORDER_STATUS_CONFIG.DELIVERED.label,
  CANCELLED: ORDER_STATUS_CONFIG.CANCELLED.label,
  RETURNED: ORDER_STATUS_CONFIG.RETURNED.label,
};

const COLOR_TONE: Record<OrderStatusColor, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
  yellow:
    'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100',
  purple:
    'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200',
  green:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100',
  red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  orange:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
};

export function orderStatusTone(status: OrderStatus): string {
  const color = ORDER_STATUS_CONFIG[status]?.color;
  return color ? COLOR_TONE[color] : '';
}
