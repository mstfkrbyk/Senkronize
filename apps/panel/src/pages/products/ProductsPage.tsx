import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { PageHeader } from '@/components/PageHeader';
import { QuickStockSearch } from '@/components/QuickStockSearch';
import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { IntegrationTableAccountingEmptyState } from '@/components/IntegrationTableAccountingEmptyState';
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
  SortableTableHead,
  type SortDirection,
} from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLoadMoreOnScroll } from '@/hooks/useLoadMoreOnScroll';
import { usePageTitle } from '@/hooks/usePageTitle';
import { flattenCategoryTree } from '@/lib/category-tree';
import { formatNavPageContext } from '@/lib/nav-page-context';
import {
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
} from '@/lib/nav-match';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { api } from '@/lib/api';
import { hasOrgProductLine } from '@/lib/org-products';
import { resolvePageEmptyProductVariant } from '@/lib/page-empty-state';
import { useAuthStore } from '@/store/auth.store';
import type { ProductListItem } from '@/types/product';
import { StockForecastTab } from '@/pages/stock/components/StockForecastTab';
import { StockKpiRow } from '@/pages/stock/components/StockKpiRow';
import { StockQuickActions } from '@/pages/stock/components/StockQuickActions';
import { StockStatusTab } from '@/pages/stock/components/StockStatusTab';
import { WarehousesTab } from '@/pages/stock/components/WarehousesTab';
import { useStockKpis } from '@/pages/stock/hooks/useStockKpis';
import { StockMovementsTab } from '@/pages/stock/StockMovementPage';
import { StockTransfersTab } from '@/pages/stock/StockTransferPage';
import { resolveStockSubtitleKey } from '@/pages/stock/stock-tabs.config';
import { formatStockNavContext } from '@/pages/stock/stock-nav-context';

import { ProductBulkActions } from './components/ProductBulkActions';
import { ProductExportMenu } from './components/ProductExportMenu';
import { ProductInlineCostCell } from './components/ProductInlineCostCell';
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
import {
  defaultProductTab,
  getProductTabDefinition,
  isProductTabId,
  PRODUCT_CATALOG_TAB_ID,
  resolveVisibleProductTabs,
  type ProductTabId,
} from './products-tabs.config';

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

type ProductSortField = NonNullable<(typeof PRODUCT_FILTER_DEFAULTS)['sortBy']>;

function sortDirectionFor(
  activeField: ProductSortField | undefined,
  field: ProductSortField,
  order: 'asc' | 'desc',
): SortDirection {
  if (activeField !== field) {
    return null;
  }
  return order;
}

function ProductTabCardDescription({
  tabId,
}: {
  tabId: ProductTabId;
}): ReactElement | null {
  const { t } = useTranslation();
  const cardDescKey = getProductTabDefinition(tabId).cardDescKey;
  if (!cardDescKey) {
    return null;
  }
  return <CardDescription>{t(cardDescKey)}</CardDescription>;
}

export function ProductsPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupLabel, pageLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.products'));
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } = useAccountingMode();
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const showStockTabs =
    shouldPlaceStockInEcommerce({ orgProducts, accountingMode }) ||
    shouldPlaceStockInNativeAccounting({ orgProducts, accountingMode });
  const visibleTabs = useMemo(
    () => resolveVisibleProductTabs(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );
  const stockSubtitleKey = useMemo(
    () => resolveStockSubtitleKey(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );
  const stockNavContext = formatStockNavContext(
    groupLabel,
    pageLabel ?? t('nav.products'),
    orgProducts,
    accountingMode,
    t,
  );

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const resolvedDefaultTab = defaultProductTab(orgProducts, accountingMode);
  const [tab, setTab] = useState<ProductTabId>(
    isProductTabId(tabParam) && visibleTabs.some((item) => item.id === tabParam)
      ? tabParam
      : resolvedDefaultTab,
  );

  useEffect(() => {
    if (
      isProductTabId(tabParam) &&
      visibleTabs.some((item) => item.id === tabParam) &&
      tabParam !== tab
    ) {
      setTab(tabParam);
    }
  }, [tabParam, tab, visibleTabs]);

  useEffect(() => {
    if (visibleTabs.some((item) => item.id === tab)) {
      return;
    }
    setTab(resolvedDefaultTab);
  }, [resolvedDefaultTab, tab, visibleTabs]);

  const onTabChange = (value: string): void => {
    if (!isProductTabId(value) || !visibleTabs.some((item) => item.id === value)) {
      return;
    }
    setTab(value);
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  const pageDescription =
    tab === PRODUCT_CATALOG_TAB_ID
      ? t('products.subtitle')
      : t(stockSubtitleKey);

  usePageTitle(t('nav.products'));
  const stockKpisEnabled =
    tab !== PRODUCT_CATALOG_TAB_ID && showStockTabs;
  const catalogQueryEnabled = tab === PRODUCT_CATALOG_TAB_ID && hasIntegration;
  const { metrics, loading: stockKpisLoading, errorMessage: stockKpisError } =
    useStockKpis(stockKpisEnabled);
  const showNativeCostColumn =
    hasOrgProductLine(orgProducts, 'ACCOUNTING') &&
    accountingMode === 'NATIVE' &&
    !accountingModeLoading;
  const pageEmptyVariant = resolvePageEmptyProductVariant(orgProducts);
  const tableColCount = showNativeCostColumn ? 10 : 9;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickStockProduct, setQuickStockProduct] = useState<QuickStockProduct | null>(
    null,
  );
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [urlFilters, setUrlFilters, resetUrlFilters] = useUrlFilters(
    PRODUCT_FILTER_DEFAULTS,
  );

  const debouncedSearch = useDebouncedValue(urlFilters.search, 300);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tree'],
    enabled: hasIntegration,
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; children?: unknown[] }>>(
        '/categories/tree',
      );
      return data;
    },
  });

  const categoryFilterOptions = useMemo(() => {
    const flat = flattenCategoryTree(categoriesQuery.data ?? []);
    return flat.map((row) => ({ value: row.id, label: row.label }));
  }, [categoriesQuery.data]);

  const filterConfig = useMemo(
    () =>
      PRODUCT_FILTER_CONFIG.map((filter) =>
        filter.key === 'categoryId'
          ? { ...filter, options: categoryFilterOptions }
          : filter,
      ),
    [categoryFilterOptions],
  );

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
      limit: PRODUCT_PAGE_SIZE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(urlFilters.categoryId ? { categoryId: urlFilters.categoryId } : {}),
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
      ...(urlFilters.sortBy
        ? { sortBy: urlFilters.sortBy, sortOrder: urlFilters.sortOrder }
        : {}),
      ...stockRange,
    };
  }, [urlFilters, debouncedSearch]);

  const queryKey = useMemo(() => ['products', 'catalog', apiFilters] as const, [apiFilters]);

  const productsQuery = useInfiniteQuery({
    queryKey,
    enabled: catalogQueryEnabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: { ...apiFilters, page: pageParam } },
      );
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const handleFilterChange = useCallback(
    (values: Record<string, unknown>): void => {
      setUrlFilters(values as typeof PRODUCT_FILTER_DEFAULTS);
    },
    [setUrlFilters],
  );

  const handleSort = useCallback(
    (field: ProductSortField) => {
      setUrlFilters({
        sortBy: field,
        sortOrder:
          urlFilters.sortBy === field && urlFilters.sortOrder === 'asc' ? 'desc' : 'asc',
      });
    },
    [setUrlFilters, urlFilters.sortBy, urlFilters.sortOrder],
  );

  const items = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data?.pages],
  );
  const total = productsQuery.data?.pages[0]?.total ?? 0;
  const hasMore =
    items.length > 0 &&
    items.length < total &&
    productsQuery.hasNextPage !== false;
  const loadMoreRef = useLoadMoreOnScroll({
    hasMore,
    loading: productsQuery.isFetchingNextPage,
    onLoadMore: () => {
      void productsQuery.fetchNextPage();
    },
  });
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

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      urlFilters.categoryId ||
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
      <PageHeader
        title={t('nav.products')}
        description={pageDescription}
        context={tab === PRODUCT_CATALOG_TAB_ID ? navContextLine : stockNavContext}
        actions={
          tab === PRODUCT_CATALOG_TAB_ID && hasIntegration ? (
            <>
              <ProductExportMenu selectedIds={selectedIdList} />
              <Button type="button" size="sm" asChild>
                <Link to="/products/import">
                  <Upload className="mr-2 size-4" />
                  {t('products.import')}
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {visibleTabs.length >= 1 ? (
        <Tabs value={tab} onValueChange={onTabChange} className="space-y-4">
          {visibleTabs.length > 1 ? (
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              {visibleTabs.map(({ id, labelKey }) => (
                <TabsTrigger key={id} value={id}>
                  {t(labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}

          {tab !== PRODUCT_CATALOG_TAB_ID && showStockTabs ? (
            <div className="space-y-4">
              <StockKpiRow
                metrics={metrics}
                loading={stockKpisLoading}
                errorMessage={stockKpisError}
              />
              <QuickStockSearch
                variant="inline"
                placeholder={t('stock.quickSearch.placeholder')}
              />
              <StockQuickActions />
            </div>
          ) : null}

          <TabsContent value={PRODUCT_CATALOG_TAB_ID} className="space-y-6">
            {hasIntegration ? (
              <>
                <AdvancedFilters
                  filters={filterConfig}
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
                      <TableSkeleton rows={8} cols={tableColCount} />
                    ) : productsQuery.isError ? (
                      <QueryErrorAlert
                        error={productsQuery.error}
                        onRetry={() => {
                          void productsQuery.refetch();
                        }}
                      />
                    ) : items.length === 0 ? (
                      pageEmptyVariant === 'accounting' ? (
                        <IntegrationTableAccountingEmptyState />
                      ) : (
                        <EmptyState
                          icon={Package}
                          title={
                            hasActiveFilters
                              ? t('products.emptyFilteredTitle')
                              : t('products.emptyTitle')
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
                      )
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
                                <TableHead className="w-[56px]">
                                  {t('products.columns.thumbnail')}
                                </TableHead>
                                <SortableTableHead
                                  label={t('products.columns.product')}
                                  sortDirection={sortDirectionFor(
                                    urlFilters.sortBy,
                                    'name',
                                    urlFilters.sortOrder,
                                  )}
                                  onSort={() => {
                                    handleSort('name');
                                  }}
                                />
                                <SortableTableHead
                                  label={t('products.columns.stock')}
                                  sortDirection={sortDirectionFor(
                                    urlFilters.sortBy,
                                    'stock',
                                    urlFilters.sortOrder,
                                  )}
                                  onSort={() => {
                                    handleSort('stock');
                                  }}
                                />
                                <TableHead className="text-center">
                                  {t('products.columns.platforms')}
                                </TableHead>
                                <SortableTableHead
                                  label={t('products.price')}
                                  className="text-right"
                                  sortDirection={sortDirectionFor(
                                    urlFilters.sortBy,
                                    'price',
                                    urlFilters.sortOrder,
                                  )}
                                  onSort={() => {
                                    handleSort('price');
                                  }}
                                />
                                {showNativeCostColumn ? (
                                  <TableHead className="text-right">{t('products.cost')}</TableHead>
                                ) : null}
                                <TableHead className="text-center">
                                  {t('products.columns.variants')}
                                </TableHead>
                                <SortableTableHead
                                  label={t('products.columns.updated')}
                                  sortDirection={sortDirectionFor(
                                    urlFilters.sortBy,
                                    'updatedAt',
                                    urlFilters.sortOrder,
                                  )}
                                  onSort={() => {
                                    handleSort('updatedAt');
                                  }}
                                />
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
                                  <TableRow
                                    key={p.id}
                                    className="cursor-pointer"
                                    onDoubleClick={() => {
                                      navigate(`/products/${p.id}`);
                                    }}
                                  >
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
                                    {showNativeCostColumn ? (
                                      <ProductInlineCostCell product={p} />
                                    ) : null}
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
                        <div ref={loadMoreRef} className="mt-4 space-y-2">
                          <p className="text-muted-foreground text-sm">
                            {t('products.loadedCount', {
                              loaded: items.length.toLocaleString('tr-TR'),
                              total: total.toLocaleString('tr-TR'),
                            })}
                          </p>
                          {productsQuery.isFetchingNextPage ? (
                            <p className="text-muted-foreground text-xs">
                              {t('common.loading')}
                            </p>
                          ) : null}
                          {!hasMore && items.length > 0 ? (
                            <p className="text-muted-foreground text-xs">
                              {t('products.allLoaded')}
                            </p>
                          ) : null}
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
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>{t(getProductTabDefinition('status').labelKey)}</CardTitle>
                <ProductTabCardDescription tabId="status" />
              </CardHeader>
              <CardContent>
                <StockStatusTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warehouses">
            <Card>
              <CardHeader>
                <CardTitle>{t(getProductTabDefinition('warehouses').labelKey)}</CardTitle>
                <ProductTabCardDescription tabId="warehouses" />
              </CardHeader>
              <CardContent>
                <WarehousesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <StockMovementsTab embedded />
          </TabsContent>

          <TabsContent value="transfers">
            <Card>
              <CardHeader>
                <CardTitle>{t(getProductTabDefinition('transfers').labelKey)}</CardTitle>
                <ProductTabCardDescription tabId="transfers" />
              </CardHeader>
              <CardContent className="p-0 pt-2">
                <StockTransfersTab embedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast">
            <Card>
              <CardHeader>
                <CardTitle>{t(getProductTabDefinition('forecast').labelKey)}</CardTitle>
                <ProductTabCardDescription tabId="forecast" />
              </CardHeader>
              <CardContent>
                <StockForecastTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
