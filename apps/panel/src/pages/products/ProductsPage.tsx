import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ChevronRight,
  MoreHorizontal,
  Package,
  Pencil,
  Upload,
  Warehouse,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { EmptyState } from '@/components/EmptyState';
import { ProductImage } from '@/components/ProductImage';
import { ProductStockStatusBadge } from '@/components/products/ProductStockStatusBadge';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
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
  QuickStockModal,
  type QuickStockProduct,
} from './components/QuickStockModal';
import {
  PRODUCT_FILTER_CONFIG,
  PRODUCT_FILTER_DEFAULTS,
  PRODUCT_PAGE_SIZE,
} from './productFilters.config';
import { stockStatusToApiRange } from './productStockStatus';

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

function formatUpdatedAt(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function listSalePrice(p: ProductListItem): unknown {
  return p.salePrice ?? p.costPrice;
}

export function ProductsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('products.catalogTitle'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickStockProduct, setQuickStockProduct] = useState<QuickStockProduct | null>(
    null,
  );
  const [quickStockOpen, setQuickStockOpen] = useState(false);
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

    const hasVariants =
      urlFilters.hasVariants === 'true'
        ? true
        : urlFilters.hasVariants === 'false'
          ? false
          : undefined;

    const stockRange =
      urlFilters.stockStatus && urlFilters.stockStatus !== 'all'
        ? stockStatusToApiRange(urlFilters.stockStatus)
        : {};

    return {
      page: urlFilters.page,
      limit: PRODUCT_PAGE_SIZE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(urlFilters.category.trim() ? { category: urlFilters.category.trim() } : {}),
      ...(urlFilters.platform ? { platform: urlFilters.platform } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(hasVariants !== undefined ? { hasVariants } : {}),
      ...(urlFilters.minPrice !== undefined ? { minPrice: urlFilters.minPrice } : {}),
      ...(urlFilters.maxPrice !== undefined ? { maxPrice: urlFilters.maxPrice } : {}),
      ...(urlFilters.minCostPrice !== undefined
        ? { minCostPrice: urlFilters.minCostPrice }
        : {}),
      ...(urlFilters.maxCostPrice !== undefined
        ? { maxCostPrice: urlFilters.maxCostPrice }
        : {}),
      ...stockRange,
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

  const openQuickStock = useCallback((p: ProductListItem) => {
    setQuickStockProduct({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      totalStock: p.totalStock ?? 0,
    });
    setQuickStockOpen(true);
  }, []);

  const allOnPageSelected =
    items.length > 0 && items.every((p) => selectedIds.has(p.id));
  const total = productsQuery.data?.total ?? 0;
  const page = urlFilters.page;
  const hasNext = page * PRODUCT_PAGE_SIZE < total;
  const hasPrev = page > 1;

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      urlFilters.category.trim() ||
      urlFilters.platform ||
      (urlFilters.stockStatus && urlFilters.stockStatus !== 'all') ||
      urlFilters.hasVariants ||
      urlFilters.isActive ||
      urlFilters.minPrice !== undefined ||
      urlFilters.maxPrice !== undefined ||
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
            <TableSkeleton rows={8} cols={9} />
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
              <ResponsiveTable>
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
                      <TableHead className="w-[56px]">{t('products.columns.thumbnail')}</TableHead>
                      <TableHead>{t('products.columns.product')}</TableHead>
                      <TableHead>{t('products.columns.stock')}</TableHead>
                      <TableHead className="text-center">
                        {t('products.columns.platforms')}
                      </TableHead>
                      <TableHead className="text-right">{t('products.price')}</TableHead>
                      <TableHead className="text-center">
                        {t('products.columns.variants')}
                      </TableHead>
                      <TableHead>{t('products.columns.updated')}</TableHead>
                      <TableHead className="w-[72px] text-right">
                        {t('products.columns.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => {
                      const thumb = p.imageUrls?.[0] ?? null;
                      const listingCount = p._count?.listings ?? 0;
                      const variantCount = p._count?.variants ?? 0;
                      const totalStock = p.totalStock ?? 0;

                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={(checked) => {
                                toggleRow(p.id, checked === true);
                              }}
                              aria-label={t('products.selectRow', { name: p.name })}
                            />
                          </TableCell>
                          <TableCell>
                            <ProductImage src={thumb} alt={p.name} size={50} />
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <Link
                                to={`/products/${p.id}`}
                                className="font-medium hover:underline"
                              >
                                {p.name}
                              </Link>
                              <p className="text-muted-foreground truncate text-xs">
                                {p.sku ? `SKU: ${p.sku}` : t('products.noSku')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ProductStockStatusBadge quantity={totalStock} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="tabular-nums">
                              {listingCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatMoney(listSalePrice(p))}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-sm">
                            {variantCount}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {formatUpdatedAt(p.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t('products.columns.actions')}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/products/${p.id}`}>
                                    <ChevronRight className="mr-2 size-4" />
                                    {t('common.detail')}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/products/${p.id}?tab=general`}>
                                    <Pencil className="mr-2 size-4" />
                                    {t('common.edit')}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    openQuickStock(p);
                                  }}
                                >
                                  <Warehouse className="mr-2 size-4" />
                                  {t('products.quickStock.action')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
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

      <QuickStockModal
        product={quickStockProduct}
        open={quickStockOpen}
        onOpenChange={setQuickStockOpen}
      />
    </div>
  );
}
