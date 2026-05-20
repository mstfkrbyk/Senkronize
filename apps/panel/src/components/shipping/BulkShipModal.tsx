import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileArchive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CargoProvider } from '@senkronize/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, getApiErrorMessage } from '@/lib/api';
import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';
import type { BulkResult, Order } from '@/types/order';
import type { BulkShipSubmitItem } from '@/types/shipping';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onSuccess?: () => void;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkShipModal({
  open,
  onOpenChange,
  orders,
  onSuccess,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const [cargoProvider, setCargoProvider] = useState<CargoProvider>('YURTICI');
  const [trackingByOrderId, setTrackingByOrderId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    const initial: Record<string, string> = {};
    for (const o of orders) {
      initial[o.id] = o.cargoTrackingNumber ?? '';
    }
    setTrackingByOrderId(initial);
    setCargoProvider('YURTICI');
  }, [open, orders]);

  const shipMutation = useMutation({
    mutationFn: async (): Promise<BulkResult> => {
      const items: BulkShipSubmitItem[] = orders.map((o) => ({
        orderId: o.id,
        cargoProvider,
        ...(trackingByOrderId[o.id]?.trim()
          ? { trackingNumber: trackingByOrderId[o.id].trim() }
          : {}),
      }));
      const { data } = await api.post<BulkResult>('/orders/bulk/ship', { items });
      return data;
    },
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.failed > 0) {
        toast.warning(
          `${String(result.success)} başarılı, ${String(result.failed)} başarısız`,
        );
      } else {
        toast.success('Siparişler kargoya verildi');
      }
      try {
        const res = await api.post(
          '/orders/bulk/shipping-labels',
          { orderIds: orders.map((o) => o.id) },
          { responseType: 'blob' },
        );
        downloadBlob(
          res.data as Blob,
          `etiketler-${new Date().toISOString().slice(0, 10)}.zip`,
        );
        toast.success('Etiket ZIP indirildi');
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err));
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const description = useMemo(
    () => `${String(orders.length)} sipariş kargoya verilecek.`,
    [orders.length],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Toplu kargoya ver</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="bulk-ship-provider">Kargo firması</Label>
            <Select
              value={cargoProvider}
              onValueChange={(v) => {
                setCargoProvider(v as CargoProvider);
              }}
            >
              <SelectTrigger id="bulk-ship-provider">
                <SelectValue placeholder="Firma seçin" />
              </SelectTrigger>
              <SelectContent>
                {CARGO_PROVIDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[min(280px,40vh)] rounded-md border">
            <ul className="divide-y p-2">
              {orders.map((o) => (
                <li key={o.id} className="grid gap-2 py-3 first:pt-1">
                  <div>
                    <p className="text-sm font-medium">{o.platformOrderId}</p>
                    <p className="text-xs text-muted-foreground">{o.customerName}</p>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`track-${o.id}`} className="text-xs">
                      Takip no (opsiyonel)
                    </Label>
                    <Input
                      id={`track-${o.id}`}
                      value={trackingByOrderId[o.id] ?? ''}
                      onChange={(e) => {
                        setTrackingByOrderId((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }));
                      }}
                      placeholder="API otomatik alabilir"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={shipMutation.isPending || orders.length === 0}
            onClick={() => {
              shipMutation.mutate();
            }}
          >
            {shipMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileArchive className="mr-2 h-4 w-4" aria-hidden />
            )}
            Kargoya ver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
