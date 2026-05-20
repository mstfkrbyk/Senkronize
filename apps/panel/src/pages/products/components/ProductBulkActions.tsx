import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderTree,
  Loader2,
  Percent,
  Send,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { BulkPriceUpdateForm } from '@/types/product';

interface Props {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function ProductBulkActions({
  selectedIds,
  onClearSelection,
}: Props): ReactElement | null {
  const queryClient = useQueryClient();
  const [priceOpen, setPriceOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [priceForm, setPriceForm] = useState<BulkPriceUpdateForm>({
    updateType: 'percentage',
    value: 10,
    direction: 'increase',
    applyToField: 'salePrice',
    previewCount: 0,
  });
  const [stockValue, setStockValue] = useState('0');
  const [categoryValue, setCategoryValue] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const priceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ updated: number; previewCount: number }>(
        '/products/bulk/price',
        {
          productIds: selectedIds,
          updateType: priceForm.updateType,
          value: priceForm.value,
          direction: priceForm.direction,
          applyToField: priceForm.applyToField,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} listing fiyatı güncellendi`);
      setPriceOpen(false);
      invalidate();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      const stock = Number.parseInt(stockValue, 10);
      const { data } = await api.post<{ updated: number }>('/products/bulk/stock', {
        productIds: selectedIds,
        stock: Number.isFinite(stock) ? stock : 0,
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} varyant stoku güncellendi`);
      setStockOpen(false);
      invalidate();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ updated: number }>(
        '/products/bulk/category',
        {
          productIds: selectedIds,
          category: categoryValue.trim(),
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} ürün kategorisi güncellendi`);
      setCategoryOpen(false);
      invalidate();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const platformMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ queued: number }>(
        '/products/bulk/sync-platforms',
        {
          productIds: selectedIds,
          platforms: selectedPlatforms,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.queued} senkron işi kuyruğa eklendi`);
      setPlatformOpen(false);
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ deleted: number }>('/products/bulk/delete', {
        productIds: selectedIds,
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} ürün silindi`);
      setDeleteOpen(false);
      onClearSelection();
      invalidate();
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
          {selectedIds.length} ürün seçildi
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => { setPriceOpen(true); }}>
            <Percent className="mr-1 size-3" />
            Fiyat güncelle
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setStockOpen(true); }}>
            <Warehouse className="mr-1 size-3" />
            Stok güncelle
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setCategoryOpen(true); }}>
            <FolderTree className="mr-1 size-3" />
            Kategori ata
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setPlatformOpen(true); }}>
            <Send className="mr-1 size-3" />
            Platforma gönder
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => { setDeleteOpen(true); }}
          >
            <Trash2 className="mr-1 size-3" />
            Sil
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onClearSelection}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu fiyat güncelleme</DialogTitle>
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
            <div className="grid gap-2">
              <Label>Alan</Label>
              <Select
                value={priceForm.applyToField}
                onValueChange={(v) => {
                  setPriceForm((f) => ({
                    ...f,
                    applyToField: v as BulkPriceUpdateForm['applyToField'],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salePrice">Satış fiyatı</SelectItem>
                  <SelectItem value="listPrice">Liste fiyatı</SelectItem>
                  <SelectItem value="both">Her ikisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedIds.length} ürünün listing kayıtları etkilenecek.
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
            <DialogTitle>Toplu stok güncelleme</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Tüm varyantlar için stok</Label>
            <Input
              inputMode="numeric"
              value={stockValue}
              onChange={(e) => { setStockValue(e.target.value); }}
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

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategori ata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Kategori adı</Label>
            <Input
              value={categoryValue}
              onChange={(e) => { setCategoryValue(e.target.value); }}
              placeholder="Örn. Elektronik"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!categoryValue.trim() || categoryMutation.isPending}
              onClick={() => {
                categoryMutation.mutate();
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={platformOpen} onOpenChange={setPlatformOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Platforma gönder</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {MARKETPLACE_OPTIONS.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <Checkbox
                  id={`bulk-plat-${opt.id}`}
                  checked={selectedPlatforms.includes(opt.id)}
                  onCheckedChange={(checked) => {
                    setSelectedPlatforms((prev) =>
                      checked
                        ? [...prev, opt.id]
                        : prev.filter((p) => p !== opt.id),
                    );
                  }}
                />
                <Label htmlFor={`bulk-plat-${opt.id}`}>{opt.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={selectedPlatforms.length === 0 || platformMutation.isPending}
              onClick={() => {
                platformMutation.mutate();
              }}
            >
              Kuyruğa ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seçili ürünleri sil</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {selectedIds.length} ürün pasifleştirilecek. Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDeleteOpen(false); }}>
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                deleteMutation.mutate();
              }}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
