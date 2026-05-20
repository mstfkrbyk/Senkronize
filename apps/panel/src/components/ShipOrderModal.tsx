import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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

interface CargoRateComparisonRow {
  connectionId: string;
  provider: string;
  providerLabel: string;
  price: number;
  currency: string;
  serviceName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tek sipariş modu */
  order?: Order | null;
  /** Toplu mod — sipariş kimlikleri */
  orderIds?: string[];
  onSuccess?: () => void;
}

export function ShipOrderModal({
  open,
  onOpenChange,
  order,
  orderIds,
  onSuccess,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const [cargoProvider, setCargoProvider] = useState<CargoProvider>('YURTICI');
  const [trackingNumber, setTrackingNumber] = useState('');

  const isBulk = (orderIds?.length ?? 0) > 0;
  const targetOrderIds = useMemo(
    () => (isBulk ? (orderIds ?? []) : order ? [order.id] : []),
    [isBulk, order, orderIds],
  );

  const compareRatesQuery = useQuery({
    queryKey: ['cargo', 'rates', 'compare', order?.id],
    queryFn: async (): Promise<CargoRateComparisonRow[]> => {
      const { data } = await api.post<CargoRateComparisonRow[]>('/cargo/rates/compare', {
        orderId: order!.id,
      });
      return data;
    },
    enabled: open && !isBulk && !!order?.id,
  });

  const providerOptions = useMemo(() => {
    const fromConnections = compareRatesQuery.data?.map((row) => ({
      value: row.provider as CargoProvider,
      label: row.providerLabel,
    }));
    if (fromConnections && fromConnections.length > 0) {
      return fromConnections;
    }
    return CARGO_PROVIDER_OPTIONS;
  }, [compareRatesQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTrackingNumber(order?.cargoTrackingNumber ?? '');
    const first = providerOptions[0]?.value ?? 'YURTICI';
    setCargoProvider(first);
  }, [open, order, providerOptions]);

  const shipMutation = useMutation({
    mutationFn: async (): Promise<BulkResult> => {
      const items = targetOrderIds.map((orderId) => ({
        orderId,
        cargoProvider,
        ...(trackingNumber.trim().length > 0
          ? { trackingNumber: trackingNumber.trim() }
          : {}),
      }));
      const { data } = await api.post<BulkResult>('/orders/bulk/ship', { items });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (order) {
        void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', order.id] });
      }
      if (result.failed > 0) {
        toast.warning(
          `${String(result.success)} başarılı, ${String(result.failed)} başarısız`,
        );
      } else {
        toast.success(isBulk ? 'Siparişler kargoya verildi' : 'Sipariş kargoya verildi');
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const title = isBulk ? 'Toplu kargoya ver' : 'Kargoya ver';
  const description = isBulk
    ? `${String(targetOrderIds.length)} sipariş kargoya verilecek.`
    : order
      ? `Sipariş no: ${order.platformOrderId}`
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ship-cargo-provider">Kargo firması</Label>
            <Select
              value={cargoProvider}
              onValueChange={(v) => {
                setCargoProvider(v as CargoProvider);
              }}
            >
              <SelectTrigger id="ship-cargo-provider">
                <SelectValue placeholder="Kargo firması seçin" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ship-tracking">Takip numarası (opsiyonel)</Label>
            <Input
              id="ship-tracking"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
              }}
              placeholder="733102837461"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={shipMutation.isPending || targetOrderIds.length === 0}
            onClick={() => {
              shipMutation.mutate();
            }}
          >
            {shipMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Kargoya ver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
