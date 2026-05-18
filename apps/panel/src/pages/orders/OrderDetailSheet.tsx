import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_LABEL_TR, orderStatusTone } from '@/lib/order-status';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Order } from '@/types/order';

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCargoUpdated?: (order: Order) => void;
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
  onCargoUpdated,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const [tracking, setTracking] = useState('');
  const [provider, setProvider] = useState('');

  useEffect(() => {
    if (order) {
      setTracking(order.cargoTrackingNumber ?? '');
      setProvider(order.cargoProvider ?? '');
    }
  }, [order]);

  const cargoMutation = useMutation({
    mutationFn: async (): Promise<Order> => {
      if (!order) {
        throw new Error('Sipariş seçilmedi');
      }
      const { data } = await api.patch<Order>(`/orders/${order.id}/status`, {
        status: 'SHIPPED',
        cargoTrackingNumber: tracking.trim() || undefined,
        cargoProvider: provider.trim() || undefined,
      });
      return data;
    },
    onSuccess: (updated) => {
      toast.success('Kargo bilgisi güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onCargoUpdated?.(updated);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const canEditCargo =
    order &&
    !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(order.status);

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
              <Badge
                variant="outline"
                className={orderStatusTone(order.status)}
              >
                {ORDER_STATUS_LABEL_TR[order.status]}
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

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Kargo bilgisi güncelle</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Takip numarası ve kargo firması girerek siparişi kargoda olarak
                işaretleyin.
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="cargo-tracking">Kargo takip numarası</Label>
                  <Input
                    id="cargo-tracking"
                    name="cargoTrackingNumber"
                    autoComplete="off"
                    value={tracking}
                    onChange={(e) => {
                      setTracking(e.target.value);
                    }}
                    disabled={!canEditCargo}
                    placeholder="Örn. 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo-provider">Kargo firması</Label>
                  <Input
                    id="cargo-provider"
                    name="cargoProvider"
                    autoComplete="organization"
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value);
                    }}
                    disabled={!canEditCargo}
                    placeholder="Örn. Aras Kargo"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={
                    !canEditCargo ||
                    cargoMutation.isPending ||
                    (!tracking.trim() && !provider.trim())
                  }
                  onClick={() => {
                    cargoMutation.mutate();
                  }}
                >
                  {cargoMutation.isPending ? 'Kaydediliyor…' : 'Güncelle'}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
