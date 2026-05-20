import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

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

export type QuickStockReason = 'COUNT' | 'IN' | 'OUT' | 'ADJUSTMENT';

export interface QuickStockProduct {
  id: string;
  barcode: string;
  name: string;
  totalStock: number;
}

interface Props {
  product: QuickStockProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickStockModal({
  product,
  open,
  onOpenChange,
}: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newStock, setNewStock] = useState('0');
  const [reason, setReason] = useState<QuickStockReason>('COUNT');

  useEffect(() => {
    if (product && open) {
      setNewStock(String(product.totalStock));
      setReason('COUNT');
    }
  }, [product, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) {
        return;
      }
      const quantity = Number.parseInt(newStock, 10);
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error(t('products.quickStock.invalidQuantity'));
      }
      const reasonLabel = t(`products.quickStock.reasons.${reason}`);
      await api.patch(`/products/${product.id}/stock`, {
        quantity,
        reason,
        note: reasonLabel,
      });
    },
    onSuccess: async () => {
      toast.success(t('products.quickStock.saved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      if (product) {
        await queryClient.invalidateQueries({
          queryKey: ['product-detail', product.id],
        });
      }
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('products.quickStock.title')}</DialogTitle>
          <DialogDescription>
            {product ? product.name : ''}
          </DialogDescription>
        </DialogHeader>
        {product ? (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('products.quickStock.current')}</Label>
              <p className="text-2xl font-semibold tabular-nums">
                {product.totalStock.toLocaleString('tr-TR')}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-stock-new">{t('products.quickStock.new')}</Label>
              <Input
                id="quick-stock-new"
                type="number"
                min={0}
                inputMode="numeric"
                value={newStock}
                onChange={(e) => {
                  setNewStock(e.target.value);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('products.quickStock.reason')}</Label>
              <Select
                value={reason}
                onValueChange={(v) => {
                  setReason(v as QuickStockReason);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COUNT">
                    {t('products.quickStock.reasons.COUNT')}
                  </SelectItem>
                  <SelectItem value="IN">
                    {t('products.quickStock.reasons.IN')}
                  </SelectItem>
                  <SelectItem value="OUT">
                    {t('products.quickStock.reasons.OUT')}
                  </SelectItem>
                  <SelectItem value="ADJUSTMENT">
                    {t('products.quickStock.reasons.ADJUSTMENT')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!product || mutation.isPending}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('products.quickStock.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
