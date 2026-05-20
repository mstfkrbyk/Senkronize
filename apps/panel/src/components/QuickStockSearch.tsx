import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface Props {
  variant?: 'dialog' | 'inline';
  placeholder?: string;
}

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

function useStockQuickSearch(enabled: boolean, searchTrim: string) {
  return useQuery({
    queryKey: ['stock', 'quick-search', searchTrim],
    queryFn: async (): Promise<StockListResponse> => {
      const { data: body } = await api.get<StockListResponse>('/stock', {
        params: { search: searchTrim, limit: 20, page: 1 },
      });
      return body;
    },
    enabled: enabled && searchTrim.length > 0,
    staleTime: 15_000,
  });
}

interface RowProps {
  row: StockEntry;
  onPick: () => void;
  showWarehouse?: boolean;
}

function StockQuickRow({
  row,
  onPick,
  showWarehouse = false,
}: RowProps): ReactElement {
  const title = row.product?.name ?? row.barcode;
  const sku = row.product?.sku ?? '—';
  const warehouse =
    row.warehouseName ?? row.warehouseCode ?? platformLabel(row.platform);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!row.product?.id}
      className="hover:bg-muted flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground text-xs">
        SKU: {sku} · {row.barcode} · Stok: {row.quantity.toLocaleString('tr-TR')}
        {showWarehouse ? ` · ${warehouse}` : ` · ${platformLabel(row.platform)}`}
      </span>
    </button>
  );
}

function navigateToProduct(
  navigate: ReturnType<typeof useNavigate>,
  row: StockEntry,
): void {
  if (row.product?.id) {
    navigate(`/products/${row.product.id}`);
  }
}

function QuickStockSearchInline({
  placeholder,
}: {
  placeholder: string;
}): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebounced(q, 280);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTrim = debounced.trim();
  const enabled = searchTrim.length > 0;

  const { data, isFetching, isError } = useStockQuickSearch(true, searchTrim);
  const items = data?.items ?? [];

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  const pickRow = useCallback(
    (row: StockEntry | undefined): void => {
      if (!row) {
        return;
      }
      navigateToProduct(navigate, row);
      setQ('');
    },
    [navigate],
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={t('stock.quickSearch.label')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(0, i - 1));
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              pickRow(items[activeIndex]);
            }
          }}
        />
      </div>
      {enabled ? (
        <div className="bg-popover absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
          {isFetching ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
              {t('stock.quickSearch.searching')}
            </p>
          ) : null}
          {isError ? (
            <p className="text-destructive px-3 py-4 text-center text-sm">
              {t('stock.quickSearch.error')}
            </p>
          ) : null}
          {!isFetching && !isError && items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {t('stock.quickSearch.noResults')}
            </p>
          ) : null}
          {items.map((row, idx) => (
            <div
              key={row.id}
              className={idx === activeIndex ? 'bg-muted/80' : ''}
            >
              <StockQuickRow
                row={row}
                showWarehouse
                onPick={() => pickRow(row)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuickStockSearchDialog(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 280);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchTrim = debounced.trim();
  const enabled = open && searchTrim.length > 0;

  const { data, isFetching, isError } = useStockQuickSearch(enabled, searchTrim);
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

  const subtitle = useMemo(() => t('stock.quickSearch.dialogHint'), [t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-3 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" aria-hidden />
            {t('stock.quickSearch.title')}
          </DialogTitle>
          <p className="text-muted-foreground text-xs font-normal">{subtitle}</p>
        </DialogHeader>
        <div className="px-4 pb-1">
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('stock.quickSearch.placeholder')}
            aria-label={t('stock.quickSearch.label')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
              }
              if (e.key === 'Enter' && items[0]) {
                e.preventDefault();
                setOpen(false);
                navigateToProduct(navigate, items[0]);
              }
            }}
          />
        </div>
        <ScrollArea className="max-h-72 px-2 pb-2">
          <div className="flex flex-col gap-1 px-2 pb-4">
            {!enabled ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {t('stock.quickSearch.typeToSearch')}
              </p>
            ) : null}
            {enabled && isFetching ? (
              <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                {t('stock.quickSearch.searching')}
              </p>
            ) : null}
            {enabled && isError ? (
              <p className="text-destructive px-2 py-4 text-center text-sm">
                {t('stock.quickSearch.error')}
              </p>
            ) : null}
            {enabled && !isFetching && !isError && items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {t('stock.quickSearch.noResults')}
              </p>
            ) : null}
            {items.map((row) => (
              <StockQuickRow
                key={row.id}
                row={row}
                showWarehouse
                onPick={() => {
                  setOpen(false);
                  navigateToProduct(navigate, row);
                }}
              />
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickStockSearch({
  variant = 'dialog',
  placeholder,
}: Props): ReactElement {
  const { t } = useTranslation();

  if (variant === 'inline') {
    return (
      <QuickStockSearchInline
        placeholder={placeholder ?? t('stock.quickSearch.placeholder')}
      />
    );
  }

  return <QuickStockSearchDialog />;
}
