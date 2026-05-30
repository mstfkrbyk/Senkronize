import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Download,
  Loader2,
  MoreHorizontal,
  PieChart,
  Scale,
  Tag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { PageHeader } from '@/components/PageHeader';
import type { FilterConfig } from '@/components/AdvancedFilters';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { platformLabel } from '@/pages/campaigns/campaign-labels';
import {
  CustomersExportNoDataError,
  exportNativeCariCsv,
  type CustomersExportFilters,
} from '@/pages/customers/customers-list-csv';
import { ledgerBalanceClass } from '@/pages/customers/customer-ledger-utils';
import { customersT } from '@/pages/customers/translations';
import { useCustomerBalanceSummary } from '@/pages/customers/useCustomerBalanceSummary';
import { useCustomerLedgerSummaries } from '@/pages/customers/useCustomerLedgerSummaries';
import {
  formatCustomerDate,
  formatTryAmount,
  SEGMENT_OPTIONS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import type { CustomerDto, CustomerSummary } from '@/types/customer';

const PAGE_SIZE = 20;

const PLATFORM_OPTIONS = [
  { value: 'TRENDYOL', label: 'Trendyol' },
  { value: 'HEPSIBURADA', label: 'Hepsiburada' },
  { value: 'N11', label: 'n11' },
  { value: 'AMAZON_TR', label: 'Amazon TR' },
  { value: 'CICEKSEPETI', label: 'Çiçeksepeti' },
  { value: 'PAZARAMA', label: 'Pazarama' },
] as const;

const FILTER_DEFAULTS: Record<string, unknown> = {
  search: '',
  platform: '',
  segment: '',
  tag: '',
  startDate: '',
  endDate: '',
  minSpent: '',
  maxSpent: '',
  minOrders: '',
  maxOrders: '',
};

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'platform',
    label: 'Platform',
    type: 'select',
    options: [{ value: '', label: 'Tümü' }, ...PLATFORM_OPTIONS],
  },
  {
    key: 'segment',
    label: 'Segment',
    type: 'select',
    options: [{ value: '', label: 'Tümü' }, ...SEGMENT_OPTIONS],
  },
  { key: 'tag', label: 'Etiket', type: 'text', placeholder: 'Etiket adı…' },
  {
    key: 'startDate',
    label: 'Son sipariş (başlangıç)',
    type: 'date_range',
    rangeEndKey: 'endDate',
  },
  {
    key: 'minSpent',
    label: 'Harcama (₺)',
    type: 'number_range',
    rangeEndKey: 'maxSpent',
  },
  {
    key: 'minOrders',
    label: 'Sipariş sayısı',
    type: 'number_range',
    rangeEndKey: 'maxOrders',
  },
];

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function CustomersPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.customers'));

  usePageTitle('Müşteriler');
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();
  const isNativeAccounting = mode === 'NATIVE';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] =
    useState<Record<string, unknown>>(FILTER_DEFAULTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('');
  const [bulkAction, setBulkAction] = useState<'add' | 'remove'>('add');
  const [exporting, setExporting] = useState(false);

  const search = String(filterValues.search ?? '').trim();

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      platform: String(filterValues.platform || '') || undefined,
      segment: String(filterValues.segment || '') || undefined,
      tag: String(filterValues.tag || '').trim() || undefined,
      startDate: String(filterValues.startDate || '') || undefined,
      endDate: String(filterValues.endDate || '') || undefined,
      minSpent: parseOptionalNumber(filterValues.minSpent),
      maxSpent: parseOptionalNumber(filterValues.maxSpent),
      minOrders: parseOptionalNumber(filterValues.minOrders),
      maxOrders: parseOptionalNumber(filterValues.maxOrders),
    }),
    [filterValues, page, search],
  );

  const listQuery = useQuery({
    queryKey: ['customers', listParams],
    queryFn: async (): Promise<{ items: CustomerDto[]; total: number }> => {
      const { data } = await api.get<{
        items: CustomerDto[];
        total: number;
      }>('/customers', { params: listParams });
      return data;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['customers-summary'],
    enabled: !isNativeAccounting && !accountingModeLoading,
    queryFn: async (): Promise<CustomerSummary> => {
      const { data } = await api.get<{ data: CustomerSummary }>('/customers/summary');
      return data.data;
    },
  });

  const balanceSummaryQuery = useCustomerBalanceSummary(
    isNativeAccounting && !accountingModeLoading,
  );

  const tagSuggestionsQuery = useQuery({
    queryKey: ['customers-tag-suggestions'],
    queryFn: async (): Promise<string[]> => {
      const { data } = await api.get<{ items: CustomerDto[] }>('/customers', {
        params: { limit: 100, page: 1 },
      });
      const tags = new Set<string>();
      for (const c of data.items) {
        for (const t of c.tags) {
          tags.add(t);
        }
      }
      return [...tags].sort((a, b) => a.localeCompare(b, 'tr'));
    },
    staleTime: 60_000,
  });

  const bulkTagMutation = useMutation({
    mutationFn: async (): Promise<{ updated: number }> => {
      const { data } = await api.patch<{ updated: number }>('/customers/bulk/tags', {
        customerIds: [...selectedIds],
        action: bulkAction,
        tag: bulkTag.trim(),
      });
      return data;
    },
    onSuccess: async (result) => {
      toast.success(`${result.updated} müşteri güncellendi.`);
      setBulkTagOpen(false);
      setBulkTag('');
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const handleFilterChange = useCallback((values: Record<string, unknown>) => {
    setFilterValues(values);
    setPage(1);
  }, []);

  const exportFilters = useMemo((): CustomersExportFilters => {
    return {
      search: search || undefined,
      platform: String(filterValues.platform || '') || undefined,
      segment: String(filterValues.segment || '') || undefined,
      tag: String(filterValues.tag || '').trim() || undefined,
      startDate: String(filterValues.startDate || '') || undefined,
      endDate: String(filterValues.endDate || '') || undefined,
      minSpent: parseOptionalNumber(filterValues.minSpent),
      maxSpent: parseOptionalNumber(filterValues.maxSpent),
      minOrders: parseOptionalNumber(filterValues.minOrders),
      maxOrders: parseOptionalNumber(filterValues.maxOrders),
    };
  }, [filterValues, search]);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      if (isNativeAccounting) {
        await exportNativeCariCsv(exportFilters);
        toast.success(customersT('list.export.successNative'));
      } else {
        const { data } = await api.get<string>('/customers/export', {
          responseType: 'text',
        });
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'musteriler.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success(customersT('list.export.successIntegration'));
      }
    } catch (e: unknown) {
      if (e instanceof CustomersExportNoDataError) {
        toast.message(customersT('list.export.noData'));
        return;
      }
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tableColCount = isNativeAccounting ? 10 : 8;

  const ledgerSummariesQuery = useCustomerLedgerSummaries(
    items.map((c) => c.id),
    isNativeAccounting,
  );
  const allOnPageSelected =
    items.length > 0 && items.every((c) => selectedIds.has(c.id));

  const toggleAllOnPage = (): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const c of items) {
          next.delete(c.id);
        }
      } else {
        for (const c of items) {
          next.add(c.id);
        }
      }
      return next;
    });
  };

  const toggleRow = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const summary = summaryQuery.data;
  const balanceSummary = balanceSummaryQuery.data;
  const balanceSummaryFailed =
    isNativeAccounting && balanceSummaryQuery.isError;
  const ledgerSummariesFailed =
    isNativeAccounting && ledgerSummariesQuery.isError;
  const kpiLoading =
    accountingModeLoading ||
    (isNativeAccounting
      ? balanceSummaryQuery.isLoading
      : summaryQuery.isLoading);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.customers')}
        description={
          isNativeAccounting
            ? customersT('list.subtitle.native')
            : customersT('list.subtitle.integration')
        }
        context={navContextLine}
        actions={
          <div className="flex flex-wrap gap-2">
            {isNativeAccounting && !accountingModeLoading ? null : (
              <Button variant="outline" asChild>
                <Link to="/customers/segments">
                  <PieChart className="mr-2 size-4" />
                  Segmentler
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {customersT('list.export.csv')}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isNativeAccounting ? (
          balanceSummaryFailed ? (
            <Card className="sm:col-span-2 xl:col-span-4">
              <CardContent className="py-6 text-center text-sm text-destructive">
                {customersT('list.error.balanceSummaryFailed')}
                {balanceSummaryQuery.error ? (
                  <p className="mt-1 text-muted-foreground">
                    {getApiErrorMessage(balanceSummaryQuery.error)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {customersT('list.kpi.customerCount')}
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading
                    ? '…'
                    : (balanceSummary?.customerCount ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {customersT('list.kpi.totalDebit')}
                </CardTitle>
                <TrendingUp className="size-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading ? '…' : formatTryAmount(balanceSummary?.totalDebit ?? '0')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {customersT('list.kpi.totalCredit')}
                </CardTitle>
                <Banknote className="size-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading ? '…' : formatTryAmount(balanceSummary?.totalCredit ?? '0')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {customersT('list.kpi.netBalance')}
                </CardTitle>
                <Scale className="size-4 text-sky-500" />
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-semibold tabular-nums ${ledgerBalanceClass(balanceSummary?.netBalance ?? '0')}`}
                >
                  {kpiLoading ? '…' : formatTryAmount(balanceSummary?.netBalance ?? '0')}
                </p>
              </CardContent>
            </Card>
          </>
          )
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam müşteri
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading
                    ? '…'
                    : (summary?.total ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Yeni (bu ay)
                </CardTitle>
                <UserPlus className="size-4 text-sky-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading
                    ? '…'
                    : (summary?.newThisMonth ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Yüksek değerli (üst %10)
                </CardTitle>
                <TrendingUp className="size-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading
                    ? '…'
                    : (summary?.highValue ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Kayıp (90+ gün)
                </CardTitle>
                <TrendingDown className="size-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpiLoading
                    ? '…'
                    : (summary?.churned ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <Input
            placeholder="Ad, e-posta veya telefon ara…"
            value={search}
            onChange={(e) =>
              handleFilterChange({ ...filterValues, search: e.target.value })
            }
            className="sm:max-w-sm"
          />
          <AdvancedFilters
            filters={FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={() => {
              setFilterValues(FILTER_DEFAULTS);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} müşteri seçildi
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBulkAction('add');
              setBulkTagOpen(true);
            }}
          >
            <Tag className="mr-1 size-3.5" />
            Etiket ekle
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBulkAction('remove');
              setBulkTagOpen(true);
            }}
          >
            Etiket sil
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Seçimi temizle
          </Button>
        </div>
      ) : null}

      {listQuery.isLoading || (isNativeAccounting && accountingModeLoading) ? (
        <TableSkeleton cols={tableColCount} rows={8} />
      ) : listQuery.isError ? (
        <EmptyState
          icon={Users}
          title={customersT('list.error.loadFailed')}
          description={getApiErrorMessage(listQuery.error)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={customersT('list.empty.title')}
          description={
            isNativeAccounting
              ? customersT('list.empty.descriptionNative')
              : customersT('list.empty.descriptionIntegration')
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Sayfadaki tümünü seç"
                    />
                  </TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Platform</TableHead>
                  {isNativeAccounting ? (
                    <>
                      <TableHead className="text-right">
                        {customersT('list.columns.debit')}
                      </TableHead>
                      <TableHead className="text-right">
                        {customersT('list.columns.credit')}
                      </TableHead>
                      <TableHead className="text-right">
                        {customersT('list.columns.balance')}
                      </TableHead>
                    </>
                  ) : (
                    <TableHead className="text-right font-medium">
                      {customersT('list.columns.orders')}
                    </TableHead>
                  )}
                  <TableHead>Etiketler</TableHead>
                  <TableHead>Son sipariş</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const ledger = ledgerSummariesQuery.data?.[c.id];
                  const ledgerLoading =
                    isNativeAccounting &&
                    !ledgerSummariesFailed &&
                    (ledgerSummariesQuery.isLoading || ledgerSummariesQuery.isFetching);
                  const ledgerCell =
                    ledgerSummariesFailed
                      ? customersT('list.error.ledgerFailed')
                      : ledgerLoading
                        ? '…'
                        : null;

                  return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleRow(c.id)}
                        aria-label={`${c.name} seç`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {c.platform ? platformLabel(c.platform) : '—'}
                    </TableCell>
                    {isNativeAccounting ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {ledgerCell ?? formatTryAmount(ledger?.debit ?? '0')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {ledgerCell ?? formatTryAmount(ledger?.credit ?? '0')}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            ledgerCell
                              ? 'text-destructive'
                              : ledger?.balance
                                ? ledgerBalanceClass(ledger.balance)
                                : 'text-muted-foreground'
                          }`}
                        >
                          {ledgerCell ?? formatTryAmount(ledger?.balance ?? '0')}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="text-right tabular-nums font-semibold">
                        {c.totalOrders.toLocaleString('tr-TR')}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          c.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        )}
                        {c.tags.length > 3 ? (
                          <Badge variant="outline" className="text-xs">
                            +{c.tags.length - 3}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatCustomerDate(c.lastOrderAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/customers/${c.id}`}>Detay</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Toplam {total.toLocaleString('tr-TR')} müşteri · Sayfa {page} /{' '}
              {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'add' ? 'Toplu etiket ekle' : 'Toplu etiket sil'}
            </DialogTitle>
            <DialogDescription>
              {selectedIds.size} müşteriye uygulanacak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-tag">Etiket</Label>
            <Input
              id="bulk-tag"
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="ör. kurumsal"
              list="tag-suggestions"
            />
            <datalist id="tag-suggestions">
              {(tagSuggestionsQuery.data ?? []).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagOpen(false)}>
              İptal
            </Button>
            <Button
              disabled={!bulkTag.trim() || bulkTagMutation.isPending}
              onClick={() => bulkTagMutation.mutate()}
            >
              {bulkTagMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
