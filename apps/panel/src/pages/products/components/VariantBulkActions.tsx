import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  Barcode,
  Loader2,
  Percent,
  Power,
  Warehouse,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import type { BulkPriceUpdateForm } from '@/types/product';

interface Props {
  productId: string;
  selectedIds: string[];
  onClearSelection: () => void;
  onDone: () => void;
}

export function VariantBulkActions({
  productId,
  selectedIds,
  onClearSelection,
  onDone,
}: Props): ReactElement | null {
  const [priceOpen, setPriceOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);

  const [priceForm, setPriceForm] = useState<BulkPriceUpdateForm>({
    updateType: 'percentage',
    value: 10,
    direction: 'increase',
    applyToField: 'salePrice',
    previewCount: 0,
  });
  const [stockDelta, setStockDelta] = useState('0');
  const [activeValue, setActiveValue] = useState<'true' | 'false'>('true');

  const priceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ updated: number }>(
        `/products/${productId}/variants/bulk-price`,
        {
          updateType: priceForm.updateType,
          value: priceForm.value,
          direction: priceForm.direction,
          variantIds: selectedIds,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyant fiyatı güncellendi`);
      setPriceOpen(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      const delta = Number.parseInt(stockDelta, 10);
      const { data } = await api.patch<{ updated: number }>(
        `/products/${productId}/variants/bulk-stock`,
        {
          variantIds: selectedIds,
          delta: Number.isFinite(delta) ? delta : 0,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyant stoku güncellendi`);
      setStockOpen(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const activeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ updated: number }>(
        `/products/${productId}/variants/bulk-active`,
        {
          variantIds: selectedIds,
          isActive: activeValue === 'true',
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyant durumu güncellendi`);
      setActiveOpen(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const barcodeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ updated: number }>(
        `/products/${productId}/variants/bulk-barcode`,
        { variantIds: selectedIds },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyanta barkod atandı`);
      setBarcodeOpen(false);
      onDone();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-accent/10 border-accent/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <p className="text-sm font-medium">
          {selectedIds.length} varyant seçildi
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setPriceOpen(true);
            }}
          >
            <Percent className="mr-1 size-3" />
            Fiyat uygula
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setStockOpen(true);
            }}
          >
            <Warehouse className="mr-1 size-3" />
            Stok ekle/çıkar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setActiveOpen(true);
            }}
          >
            <Power className="mr-1 size-3" />
            Aktif/Pasif
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setBarcodeOpen(true);
            }}
          >
            <Barcode className="mr-1 size-3" />
            Barkod ata
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onClearSelection}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seçili varyantlara fiyat uygula</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Güncelleme tipi</Label>
              <Select
                value={priceForm.updateType}
                onValueChange={(v) => {
                  setPriceForm((f) => ({
                    ...f,
                    updateType: v as BulkPriceUpdateForm['updateType'],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Yüzde</SelectItem>
                  <SelectItem value="fixed">Sabit tutar</SelectItem>
                  <SelectItem value="set">Belirli fiyata ayarla</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {priceForm.updateType !== 'set' ? (
              <div className="grid gap-2">
                <Label>Yön</Label>
                <Select
                  value={priceForm.direction}
                  onValueChange={(v) => {
                    setPriceForm((f) => ({
                      ...f,
                      direction: v as BulkPriceUpdateForm['direction'],
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Artır</SelectItem>
                    <SelectItem value="decrease">Azalt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Değer</Label>
              <Input
                inputMode="decimal"
                value={String(priceForm.value)}
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value.replace(',', '.'));
                  setPriceForm((f) => ({
                    ...f,
                    value: Number.isFinite(n) ? n : 0,
                  }));
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedIds.length} varyant etkilenecek.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={priceMutation.isPending}
              onClick={() => {
                priceMutation.mutate();
              }}
            >
              {priceMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Uygula'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stok ekle veya çıkar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Miktar (negatif = çıkar)</Label>
            <Input
              inputMode="numeric"
              value={stockDelta}
              onChange={(e) => {
                setStockDelta(e.target.value);
              }}
              placeholder="Örn. 5 veya -3"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={stockMutation.isPending}
              onClick={() => {
                stockMutation.mutate();
              }}
            >
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeOpen} onOpenChange={setActiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Varyant durumu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Durum</Label>
            <Select
              value={activeValue}
              onValueChange={(v) => {
                setActiveValue(v as 'true' | 'false');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Aktif</SelectItem>
                <SelectItem value="false">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={activeMutation.isPending}
              onClick={() => {
                activeMutation.mutate();
              }}
            >
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Otomatik barkod ata</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Barkodsuz {selectedIds.length} varyanta organizasyon EAN-13 öneki ile
            benzersiz barkod atanır. Mevcut barkodlar korunur.
          </p>
          <DialogFooter>
            <Button
              type="button"
              disabled={barcodeMutation.isPending}
              onClick={() => {
                barcodeMutation.mutate();
              }}
            >
              {barcodeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Barkod ata'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
