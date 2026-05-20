import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  { value: 'DEFECTIVE', labelKey: 'orders.return.reasons.defective' },
  { value: 'WRONG_ITEM', labelKey: 'orders.return.reasons.wrongItem' },
  { value: 'EXCHANGE', labelKey: 'orders.return.reasons.exchange' },
  { value: 'CUSTOMER_CHANGED_MIND', labelKey: 'orders.return.reasons.changedMind' },
  { value: 'DAMAGED', labelKey: 'orders.return.reasons.damaged' },
  { value: 'OTHER', labelKey: 'orders.return.reasons.other' },
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

export function OrderReturnDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [reason, setReason] = useState<ReturnReason>('DEFECTIVE');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) {
      setSelected(new Map());
      setReason('DEFECTIVE');
      setDescription('');
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!order) {
        throw new Error(t('orders.return.orderMissing'));
      }
      const items = [...selected.values()].map((s) => ({
        orderItemId: s.orderItemId,
        quantity: s.quantity,
      }));
      if (items.length === 0) {
        throw new Error(t('orders.return.selectProduct'));
      }
      await api.post(`/orders/${order.id}/returns`, {
        items,
        reason,
        notes: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('orders.return.success'));
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
          <DialogTitle>{t('orders.return.title')}</DialogTitle>
          <DialogDescription>
            {order
              ? t('orders.return.description', { orderNo: order.platformOrderId })
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>{t('orders.return.products')}</Label>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {(order?.items ?? []).map((item) => {
                const isChecked = selected.has(item.id);
                const qty = selected.get(item.id)?.quantity ?? 1;
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-md border bg-muted/20 p-2 dark:bg-muted/30"
                  >
                    <Checkbox
                      checked={isChecked}
                      aria-label={t('orders.return.selectItem', {
                        name: item.productName ?? item.sku,
                      })}
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
                            {t('orders.return.quantity')}
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
            <Label htmlFor="return-reason">{t('orders.return.reason')}</Label>
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
                    {t(o.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="return-description">{t('orders.return.descriptionLabel')}</Label>
            <Textarea
              id="return-description"
              rows={3}
              value={description}
              placeholder={t('orders.return.descriptionPlaceholder')}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
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
            {t('orders.return.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
