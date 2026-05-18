import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockEntry, StockListResponse } from '@/types/stock';

import {
  BARCODE_PRIORITY_QUICK_SEARCH,
  useBarcodeInputClaim,
} from '@/hooks/useBarcodeInput';

function platformLabel(platform: string | null): string {
  if (!platform) {
    return 'Merkezi';
  }
  return getMarketplaceBranding(platform).label;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function QuickStockSearch(): ReactElement {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 280);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchTrim = debounced.trim();
  const enabled = open && searchTrim.length > 0;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['stock', 'quick-search', searchTrim],
    queryFn: async (): Promise<StockListResponse> => {
      const { data: body } = await api.get<StockListResponse>('/stock', {
        params: { search: searchTrim, limit: 20, page: 1 },
      });
      return body;
    },
    enabled,
    staleTime: 15_000,
  });

  const items = data?.items ?? [];

  const onUsbScan = useCallback(
    (code: string) => {
      if (!open) {
        return;
      }
      setQ(code);
      void inputRef.current?.focus();
    },
    [open],
  );

  useBarcodeInputClaim('quick-stock-search', BARCODE_PRIORITY_QUICK_SEARCH, onUsbScan, open);

  useEffect(() => {
    const onShortcutOpen = (): void => {
      setOpen(true);
    };
    window.addEventListener('senkronize-open-quick-search', onShortcutOpen);
    return () => {
      window.removeEventListener('senkronize-open-quick-search', onShortcutOpen);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) {
        return;
      }
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.metaKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(true);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ('');
    }
  }, [open]);

  const subtitle = useMemo(
    () => 'Ctrl+K veya / ile aç · USB barkod okuyucu destekli',
    [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-3 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" aria-hidden />
            Hızlı stok arama
          </DialogTitle>
          <p className="text-muted-foreground text-xs font-normal">
            {subtitle}
          </p>
        </DialogHeader>
        <div className="px-4 pb-1">
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Barkod, SKU veya ürün adı…"
            aria-label="Stok arama"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
        </div>
        <ScrollArea className="max-h-72 px-2 pb-2">
          <div className="flex flex-col gap-1 px-2 pb-4">
            {!enabled ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                Aramak için yazmaya başlayın.
              </p>
            ) : null}
            {enabled && isFetching ? (
              <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                Aranıyor…
              </p>
            ) : null}
            {enabled && isError ? (
              <p className="text-destructive px-2 py-4 text-center text-sm">
                Arama başarısız oldu.
              </p>
            ) : null}
            {enabled && !isFetching && !isError && items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                Sonuç bulunamadı.
              </p>
            ) : null}
            {items.map((row) => (
              <StockQuickRow
                key={row.id}
                row={row}
                onPick={() => {
                  setOpen(false);
                  if (row.product?.id) {
                    navigate(`/products/${row.product.id}`);
                  }
                }}
              />
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RowProps {
  row: StockEntry;
  onPick: () => void;
}

function StockQuickRow({ row, onPick }: RowProps): ReactElement {
  const title = row.product?.name ?? row.barcode;
  const sku = row.product?.sku ?? '—';
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!row.product?.id}
      className="hover:bg-muted flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground text-xs">
        SKU: {sku} · Barkod: {row.barcode} · {platformLabel(row.platform)} · Stok:{' '}
        {row.quantity}
      </span>
    </button>
  );
}
