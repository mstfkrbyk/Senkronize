import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Package, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

import { ProductBulkActions } from './components/ProductBulkActions';
import { ProductExportMenu } from './components/ProductExportMenu';
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
  const { t } = useTranslation();
  usePageTitle(t('products.catalogTitle'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const items = productsQuery.data?.items ?? [];
  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds]);

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of items) {
          if (checked) {
            next.add(p.id);
          } else {
            next.delete(p.id);
          }
        }
        return next;
      });
    },
    [items],
  );

  const allOnPageSelected =
    items.length > 0 && items.every((p) => selectedIds.has(p.id));
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
          <h1 className="text-2xl font-semibold tracking-tight">{t('products.catalogTitle')}</h1>
          <p className="text-muted-foreground text-sm">{t('products.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProductExportMenu selectedIds={selectedIdList} />
          <Button type="button" size="sm" asChild>
            <Link to="/products/import">
              <Upload className="mr-2 size-4" />
              {t('products.import')}
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

      <ProductBulkActions
        selectedIds={selectedIdList}
        onClearSelection={() => {
          setSelectedIds(new Set());
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            {t('products.title')}
          </CardTitle>
          <CardDescription>
            {t('products.totalRecords', { count: total.toLocaleString('tr-TR') })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {productsQuery.isLoading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : productsQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(productsQuery.error)}
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                hasActiveFilters ? t('products.emptyFilteredTitle') : t('products.emptyTitle')
              }
              description={
                hasActiveFilters
                  ? t('products.emptyFilteredDescription')
                  : t('products.emptyDescription')
              }
              actionSlot={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" size="sm" asChild>
                    <Link to="/products/import">{t('products.importAction')}</Link>
                  </Button>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link to="/connections">{t('products.openConnections')}</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(checked) => {
                          toggleAllOnPage(checked === true);
                        }}
                        aria-label={t('common.selectAllOnPage')}
                      />
                    </TableHead>
                    <TableHead>{t('products.name')}</TableHead>
                    <TableHead>{t('products.sku')}</TableHead>
                    <TableHead>{t('products.barcode')}</TableHead>
                    <TableHead>{t('products.brand')}</TableHead>
                    <TableHead>{t('products.category')}</TableHead>
                    <TableHead className="text-right">{t('products.cost')}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={(checked) => {
                            toggleRow(p.id, checked === true);
                          }}
                          aria-label={`${p.name} seç`}
                        />
                      </TableCell>
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
                            {t('common.detail')}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {t('products.pageOf', {
                    page,
                    total: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)),
                  })}
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
                    {t('common.previous')}
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
                    {t('common.next')}
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
