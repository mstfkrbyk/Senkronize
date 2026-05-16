import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function statusTone(status: OrderStatus): string {
  const tone: Record<OrderStatus, string> = {
    NEW: 'border-blue-200 bg-blue-50 text-blue-800',
    PICKING: 'border-amber-200 bg-amber-50 text-amber-900',
    INVOICED: 'border-violet-200 bg-violet-50 text-violet-800',
    SHIPPED: 'border-orange-200 bg-orange-50 text-orange-800',
    DELIVERED: 'border-green-200 bg-green-50 text-green-800',
    CANCELLED: 'border-red-200 bg-red-50 text-red-800',
    RETURNED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return tone[status] ?? '';
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
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
}: Props): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {order ? (
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span aria-hidden>
                {getMarketplaceBranding(order.platform).logo}
              </span>
              Sipariş {order.platformOrderId}
            </SheetTitle>
            <SheetDescription>
              {getMarketplaceBranding(order.platform).label} ·{' '}
              {formatDate(order.platformCreatedAt)}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Durum</span>
              <Badge variant="outline" className={statusTone(order.status)}>
                {STATUS_LABEL[order.status]}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Müşteri</p>
              <p className="mt-1 text-sm">{order.customerName}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tutar:{' '}
                <span className="font-semibold text-foreground">
                  {formatTry(order.totalAmount, order.currency)}
                </span>
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Ürünler</p>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead>Barkod</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                      <TableHead className="text-right">Birim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground"
                        >
                          Satır bulunamadı
                        </TableCell>
                      </TableRow>
                    ) : (
                      order.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[180px] truncate">
                            {item.productName ?? item.sku}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.barcode}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(item.unitPrice, order.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {order.cargoTrackingNumber || order.cargoProvider ? (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Kargo</p>
                {order.cargoProvider ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.cargoProvider}
                  </p>
                ) : null}
                {order.cargoTrackingNumber ? (
                  <p className="mt-1 font-mono text-sm">
                    Takip: {order.cargoTrackingNumber}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
