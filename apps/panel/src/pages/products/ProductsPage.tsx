import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Download, Package, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ProductListItem } from '@/types/product';

import {
  PRODUCT_FILTER_CONFIG,
  PRODUCT_FILTER_DEFAULTS,
  PRODUCT_PAGE_SIZE,
} from './productFilters.config';

function formatMoney(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function ProductsPage(): ReactElement {
  usePageTitle('Ürün Kataloğu');
  const [urlFilters, setUrlFilters, resetUrlFilters] = useUrlFilters(
    PRODUCT_FILTER_DEFAULTS,
  );

  const debouncedSearch = useDebouncedValue(urlFilters.search, 300);

  const apiFilters = useMemo(() => {
    const isActive =
      urlFilters.isActive === 'true'
        ? true
        : urlFilters.isActive === 'false'
          ? false
          : undefined;

    return {
      page: urlFilters.page,
      limit: PRODUCT_PAGE_SIZE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(urlFilters.category.trim() ? { category: urlFilters.category.trim() } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(urlFilters.minCostPrice !== undefined
        ? { minCostPrice: urlFilters.minCostPrice }
        : {}),
      ...(urlFilters.maxCostPrice !== undefined
        ? { maxCostPrice: urlFilters.maxCostPrice }
        : {}),
    };
  }, [urlFilters, debouncedSearch]);

  const queryKey = useMemo(() => ['products', apiFilters] as const, [apiFilters]);

  const productsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: apiFilters },
      );
      return data;
    },
  });

  const handleFilterChange = useCallback(
    (values: Record<string, unknown>): void => {
      setUrlFilters({
        ...(values as typeof PRODUCT_FILTER_DEFAULTS),
        page: 1,
      });
    },
    [setUrlFilters],
  );

  const exportCsv = useCallback(async () => {
    const res = await api.get<Blob>('/products/export', {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urunler.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const page = urlFilters.page;
  const hasNext = page * PRODUCT_PAGE_SIZE < total;
  const hasPrev = page > 1;

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      urlFilters.category.trim() ||
      urlFilters.isActive ||
      urlFilters.minCostPrice !== undefined ||
      urlFilters.maxCostPrice !== undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ürün Kataloğu</h1>
          <p className="text-muted-foreground text-sm">
            Merkezi ürün kayıtları ve varyantlar
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download className="mr-2 size-4" />
            Dışa Aktar
          </Button>
          <Button type="button" size="sm" asChild>
            <Link to="/products/import">
              <Upload className="mr-2 size-4" />
              İçe Aktar
            </Link>
          </Button>
        </div>
      </div>

      <AdvancedFilters
        filters={PRODUCT_FILTER_CONFIG}
        values={urlFilters}
        onChange={handleFilterChange}
        onReset={resetUrlFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Ürünler
          </CardTitle>
          <CardDescription>
            Toplam {total.toLocaleString('tr-TR')} kayıt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {productsQuery.isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : productsQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(productsQuery.error)}
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={hasActiveFilters ? 'Filtrelere uygun ürün yok' : 'Henüz ürün yok'}
              description={
                hasActiveFilters
                  ? 'Filtreleri değiştirerek tekrar deneyin.'
                  : 'İlk ürününüzü içe aktararak veya bağlantılarınızı kurarak kataloğunuzu oluşturun.'
              }
              actionSlot={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" size="sm" asChild>
                    <Link to="/products/import">İçe aktar</Link>
                  </Button>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link to="/connections">Bağlantıları aç</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Barkod</TableHead>
                    <TableHead>Marka</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Maliyet</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.sku ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.barcode}</TableCell>
                      <TableCell>{p.brand ?? '—'}</TableCell>
                      <TableCell>{p.category ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatMoney(p.costPrice)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/products/${p.id}`}>
                            <ChevronRight className="mr-1 size-3" />
                            Detay
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  Sayfa {page} / {Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE))}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => {
                      setUrlFilters({ page: Math.max(1, page - 1) });
                    }}
                  >
                    Önceki
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => {
                      setUrlFilters({ page: page + 1 });
                    }}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
