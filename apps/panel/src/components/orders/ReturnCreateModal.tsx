import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ProductImage } from '@/components/ProductImage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { api, getApiErrorMessage } from '@/lib/api';
import type { Order } from '@/types/order';

export const RETURN_REASON_OPTIONS = [
  { value: 'DAMAGED', label: 'Hasarlı' },
  { value: 'WRONG_ITEM', label: 'Yanlış Ürün' },
  { value: 'CUSTOMER_CHANGED_MIND', label: 'Müşteri Vazgeçti' },
  { value: 'OTHER', label: 'Diğer' },
] as const;

export type ReturnReason = (typeof RETURN_REASON_OPTIONS)[number]['value'];

interface SelectedItem {
  orderItemId: string;
  quantity: number;
  maxQuantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSuccess?: () => void;
}

export function ReturnCreateModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [reason, setReason] = useState<ReturnReason>('DAMAGED');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setSelected(new Map());
      setReason('DAMAGED');
      setNotes('');
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!order) {
        throw new Error('Sipariş bulunamadı');
      }
      const items = [...selected.values()].map((s) => ({
        orderItemId: s.orderItemId,
        quantity: s.quantity,
      }));
      if (items.length === 0) {
        throw new Error('En az bir ürün seçin');
      }
      await api.post(`/orders/${order.id}/returns`, {
        items,
        reason,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('İade kaydı oluşturuldu');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (order) {
        void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', order.id] });
      }
      void queryClient.invalidateQueries({ queryKey: ['returns'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleItem = (orderItemId: string, maxQuantity: number, checked: boolean): void => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(orderItemId, { orderItemId, quantity: 1, maxQuantity });
      } else {
        next.delete(orderItemId);
      }
      return next;
    });
  };

  const setQuantity = (orderItemId: string, quantity: number, maxQuantity: number): void => {
    setSelected((prev) => {
      const next = new Map(prev);
      const clamped = Math.max(1, Math.min(maxQuantity, quantity));
      next.set(orderItemId, { orderItemId, quantity: clamped, maxQuantity });
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>İade oluştur</DialogTitle>
          <DialogDescription>
            {order
              ? `Sipariş no: ${order.platformOrderId} — iade edilecek ürünleri seçin.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Ürünler</Label>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {(order?.items ?? []).map((item) => {
                const isChecked = selected.has(item.id);
                const qty = selected.get(item.id)?.quantity ?? 1;
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-md border bg-muted/20 p-2"
                  >
                    <Checkbox
                      checked={isChecked}
                      aria-label={`${item.productName ?? item.sku} seç`}
                      onCheckedChange={(v) => {
                        toggleItem(item.id, item.quantity, v === true);
                      }}
                    />
                    {item.thumbnailUrl ? (
                      <ProductImage
                        src={item.thumbnailUrl}
                        alt=""
                        size={40}
                        className="h-10 w-10 shrink-0 rounded-md"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.productName ?? item.sku}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      {isChecked ? (
                        <div className="mt-2 flex items-center gap-2">
                          <Label htmlFor={`qty-${item.id}`} className="text-xs">
                            Adet
                          </Label>
                          <Input
                            id={`qty-${item.id}`}
                            type="number"
                            min={1}
                            max={item.quantity}
                            className="h-8 w-20"
                            value={qty}
                            onChange={(e) => {
                              setQuantity(
                                item.id,
                                Number(e.target.value),
                                item.quantity,
                              );
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            / {item.quantity}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="return-reason">İade nedeni</Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as ReturnReason);
              }}
            >
              <SelectTrigger id="return-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASON_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="return-notes">Notlar</Label>
            <Textarea
              id="return-notes"
              rows={3}
              value={notes}
              placeholder="İade ile ilgili ek bilgi…"
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={createMutation.isPending || selected.size === 0}
            onClick={() => {
              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            İade oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
