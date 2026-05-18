import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Order, OrderStatus } from '@/types/order';

interface Props {
  orders: Order[];
  onRowClick: (order: Order) => void;
}

function formatTry(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function PlatformBadge({ platform }: { platform: string }): ReactElement {
  const tone: Record<string, string> = {
    TRENDYOL: 'border-orange-300 bg-orange-50 text-orange-900',
    HEPSIBURADA: 'border-red-300 bg-red-50 text-red-900',
  };
  const branding = getMarketplaceBranding(platform);
  return (
    <Badge
      variant="outline"
      className={tone[platform] ?? 'border-slate-200 bg-slate-50'}
    >
      <span className="mr-1" aria-hidden>
        {branding.logo}
      </span>
      {branding.label}
    </Badge>
  );
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Yeni',
  PICKING: 'Hazırlanıyor',
  INVOICED: 'Faturalandı',
  SHIPPED: 'Kargoda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal',
  RETURNED: 'İade',
};

function StatusBadge({ status }: { status: OrderStatus }): ReactElement {
  const tone: Record<OrderStatus, string> = {
    NEW: 'border-blue-200 bg-blue-50 text-blue-800',
    PICKING: 'border-amber-200 bg-amber-50 text-amber-900',
    INVOICED: 'border-violet-200 bg-violet-50 text-violet-800',
    SHIPPED: 'border-orange-200 bg-orange-50 text-orange-800',
    DELIVERED: 'border-green-200 bg-green-50 text-green-800',
    CANCELLED: 'border-red-200 bg-red-50 text-red-800',
    RETURNED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return (
    <Badge variant="outline" className={tone[status] ?? ''}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function OrdersTable({ orders, onRowClick }: Props): ReactElement {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-[700px] w-full sm:min-w-0">
        <div className="rounded-md border">
          <Table className="min-w-[700px] sm:min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Platform</TableHead>
            <TableHead>Sipariş No</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead className="text-right">Tutar</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead className="w-[100px]">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer"
              onClick={() => {
                onRowClick(order);
              }}
            >
              <TableCell>
                <PlatformBadge platform={order.platform} />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {order.platformOrderId}
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatTry(order.totalAmount, order.currency)}
              </TableCell>
              <TableCell>
                <StatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(order.platformCreatedAt)}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowClick(order);
                  }}
                >
                  Detay
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
      </div>
    </div>
  );
}
