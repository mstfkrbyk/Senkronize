import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
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
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api';
import {
  QUICK_STOCK_ADJUST_EVENT,
  type QuickStockAdjustDetail,
} from '@/lib/quick-stock-adjust';
import { useAdjustStock } from '@/pages/stock/hooks/useStockManagement';
import type { StockListResponse } from '@/types/stock';

const REASON_LABELS: Record<string, string> = {
  COUNT: 'Sayım',
  DAMAGE: 'Hasar',
  RETURN: 'İade',
  OTHER: 'Diğer',
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function QuickStockAdjust(): ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [currentQty, setCurrentQty] = useState(0);
  const [newQty, setNewQty] = useState(0);
  const [reason, setReason] = useState('COUNT');

  const debouncedSearch = useDebounced(search, 280);
  const adjustMutation = useAdjustStock();

  const searchQuery = useQuery({
    queryKey: ['stock', 'quick-adjust-search', debouncedSearch],
    queryFn: async (): Promise<StockListResponse> => {
      const { data } = await api.get<StockListResponse>('/stock', {
        params: { search: debouncedSearch, limit: 12, page: 1 },
      });
      return data;
    },
    enabled: open && debouncedSearch.trim().length >= 2,
  });

  const pickProduct = useCallback(
    (bc: string, name: string, qty: number): void => {
      setBarcode(bc);
      setProductLabel(name);
      setCurrentQty(qty);
      setNewQty(qty);
      setSearch('');
    },
    [],
  );

  useEffect(() => {
    const onOpen = (ev: Event): void => {
      const detail = (ev as CustomEvent<QuickStockAdjustDetail>).detail;
      setOpen(true);
      if (detail?.barcode) {
        pickProduct(
          detail.barcode,
          detail.productName ?? detail.barcode,
          detail.currentQty ?? 0,
        );
      } else {
        setBarcode('');
        setProductLabel('');
        setCurrentQty(0);
        setNewQty(0);
        setSearch('');
      }
      setReason('COUNT');
    };
    window.addEventListener(QUICK_STOCK_ADJUST_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_STOCK_ADJUST_EVENT, onOpen);
  }, [pickProduct]);

  const submit = (): void => {
    if (!barcode.trim()) {
      toast.error('Ürün seçin.');
      return;
    }
    const reasonLabel = REASON_LABELS[reason] ?? reason;
    adjustMutation.mutate(
      {
        barcode: barcode.trim(),
        newQuantity: Math.max(0, newQty),
        note: `Hızlı düzeltme · ${reasonLabel}`,
      },
      {
        onSuccess: () => {
          toast.success('Stok güncellendi');
          setOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const items = searchQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hızlı stok düzeltme</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {!barcode ? (
            <div className="space-y-2">
              <Label htmlFor="qa-search">Ürün ara (barkod veya isim)</Label>
              <Input
                id="qa-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="En az 2 karakter…"
                autoFocus
              />
              {searchQuery.isFetching ? (
                <p className="text-muted-foreground text-xs">Aranıyor…</p>
              ) : null}
              {items.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-md border">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() =>
                          pickProduct(
                            item.barcode,
                            item.product?.name ?? item.barcode,
                            item.quantity,
                          )
                        }
                      >
                        <span className="font-medium">
                          {item.product?.name ?? item.barcode}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.barcode} · Mevcut: {item.quantity}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium">{productLabel}</p>
                <p className="font-mono text-xs text-muted-foreground">{barcode}</p>
                <p className="mt-1 text-sm">
                  Mevcut stok:{' '}
                  <span className="font-semibold tabular-nums">
                    {currentQty.toLocaleString('tr-TR')}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-xs"
                  onClick={() => {
                    setBarcode('');
                    setProductLabel('');
                  }}
                >
                  Ürün değiştir
                </Button>
              </div>

              <div className="space-y-1">
                <Label htmlFor="qa-qty">Yeni miktar</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Azalt"
                    onClick={() => setNewQty((q) => Math.max(0, q - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="qa-qty"
                    type="number"
                    min={0}
                    className="text-center"
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Artır"
                    onClick={() => setNewQty((q) => q + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Sebep</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={submit}
            disabled={adjustMutation.isPending || !barcode.trim()}
          >
            Onayla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
