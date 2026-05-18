import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  selectedIds: Set<string>;
  onToggleRow: (id: string, selected: boolean) => void;
  onToggleAllOnPage: (selected: boolean) => void;
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
    TRENDYOL:
      'border-orange-300/80 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-100',
    HEPSIBURADA:
      'border-red-300/80 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
  };
  const branding = getMarketplaceBranding(platform);
  return (
    <Badge
      variant="outline"
      className={
        tone[platform] ??
        'border-border bg-muted/50 text-foreground dark:bg-muted/30'
      }
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
    NEW:
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
    PICKING:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    INVOICED:
      'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
    SHIPPED:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100',
    DELIVERED:
      'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100',
    CANCELLED:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    RETURNED:
      'border-border bg-muted text-muted-foreground dark:bg-muted/40',
  };
  return (
    <Badge variant="outline" className={tone[status] ?? ''}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function OrdersTable({
  orders,
  selectedIds,
  onToggleRow,
  onToggleAllOnPage,
  onRowClick,
}: Props): ReactElement {
  const pageIds = orders.map((o) => o.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <div className="inline-block min-w-[700px] w-full lg:min-w-0">
          <div className="rounded-md border border-border bg-card">
            <Table className="min-w-[700px] lg:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px] p-2">
                    <Checkbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(v) => {
                        onToggleAllOnPage(v === true);
                      }}
                      aria-label="Bu sayfadaki tüm siparişleri seç"
                    />
                  </TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Sipariş No</TableHead>
                  <TableHead className="hidden lg:table-cell">Müşteri</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="hidden xl:table-cell">Tarih</TableHead>
                  <TableHead className="hidden lg:table-cell w-[100px]">İşlemler</TableHead>
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
                    <TableCell
                      className="w-[44px] p-2"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={(v) => {
                          onToggleRow(order.id, v === true);
                        }}
                        aria-label={`Seç: ${order.platformOrderId}`}
                      />
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={order.platform} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order.platformOrderId}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{order.customerName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTry(order.totalAmount, order.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {formatDate(order.platformCreatedAt)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
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

      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <Card
            key={order.id}
            className="border-border bg-card shadow-sm"
            role="button"
            tabIndex={0}
            onClick={() => {
              onRowClick(order);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick(order);
              }
            }}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={order.platform} />
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="font-mono text-sm font-medium text-foreground">
                    {order.platformOrderId}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{order.customerName}</p>
                </div>
                <Checkbox
                  checked={selectedIds.has(order.id)}
                  onCheckedChange={(v) => {
                    onToggleRow(order.id, v === true);
                  }}
                  aria-label={`Seç: ${order.platformOrderId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatTry(order.totalAmount, order.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.platformCreatedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onRowClick(order);
                }}
              >
                Detayı aç
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
