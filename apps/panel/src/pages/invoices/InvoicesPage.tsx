import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { FileText, Plus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type {
  InvoiceDto,
  InvoiceListMeta,
  InvoiceListResponse,
  InvoiceStatus,
} from '@/types/invoice';

import { CreateFromOrderDialog } from './CreateFromOrderDialog';
import { CreateManualInvoiceDialog } from './CreateManualInvoiceDialog';
import { InvoicesExternalErpBanner } from './InvoicesExternalErpBanner';
import { InvoiceDetailSheet } from './InvoiceDetailSheet';
import { InvoicesBulkConfirmDialogs } from './InvoicesBulkConfirmDialogs';
import { InvoicesBulkToolbar } from './InvoicesBulkToolbar';
import {
  INVOICE_FILTER_CONFIG,
  INVOICE_FILTER_DEFAULTS,
  type InvoiceUrlFilters,
} from './invoice-filters.config';
import { formatInvoicesNavContext } from './invoices-nav-context';
import { InvoicesOverdueAlert } from './InvoicesOverdueAlert';
import { InvoicesStatsRow } from './InvoicesStatsRow';
import { InvoicesStatusFilter } from './InvoicesStatusFilter';
import { InvoicesTable } from './InvoicesTable';
import {
  idsBulkIssueEligible,
  idsBulkMarkPaidEligible,
  countBulkIssueEligible,
  countBulkMarkPaidEligible,
  useInvoicesBulkActions,
} from './useInvoicesBulkActions';
import { useInvoiceStats } from './useInvoiceStats';
import { invoicesT } from './translations';

const PAGE_SIZE = 20;

export function InvoicesPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const pageTitle = t('nav.invoices');
  const navContextLine = formatInvoicesNavContext(
    groupLabel,
    pageTitle,
    orgProducts,
    t,
  );

  usePageTitle(pageTitle);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [urlFilters, setUrlFilters, resetUrlFilters] = useUrlFilters<InvoiceUrlFilters>(
    INVOICE_FILTER_DEFAULTS,
  );
  const debouncedSearch = useDebouncedValue(urlFilters.search, 300);

  const [manualOpen, setManualOpen] = useState(false);
  const [fromOrderOpen, setFromOrderOpen] = useState(false);

  const { mode: accountingMode, isLoading: accountingModeLoading } = useAccountingMode();
  const isNativeAccounting = accountingMode === 'NATIVE';
  const isExternalErp = accountingMode === 'EXTERNAL_ERP';

  useEffect(() => {
    if (searchParams.get('create') !== 'manual') {
      return;
    }
    if (accountingModeLoading) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    if (isNativeAccounting) {
      setManualOpen(true);
    }
  }, [searchParams, setSearchParams, accountingModeLoading, isNativeAccounting]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkIssueConfirmOpen, setBulkIssueConfirmOpen] = useState(false);
  const [bulkMarkPaidConfirmOpen, setBulkMarkPaidConfirmOpen] = useState(false);

  const showNativeList = isNativeAccounting && !accountingModeLoading;
  const showExternalBanner = isExternalErp && !accountingModeLoading;

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const { issueMutation, markPaidMutation } = useInvoicesBulkActions({
    onSettled: clearSelection,
  });

  const statsQuery = useInvoiceStats(showNativeList);

  const listMetaQuery = useQuery({
    queryKey: [
      'invoices',
      'list-meta',
      debouncedSearch,
      urlFilters.startDate,
      urlFilters.endDate,
    ],
    queryFn: async (): Promise<{ meta: InvoiceListMeta; totalAll: number }> => {
      const { data } = await api.get<InvoiceListResponse>('/invoices', {
        params: {
          page: 1,
          limit: 1,
          search: debouncedSearch.trim() || undefined,
          startDate: urlFilters.startDate || undefined,
          endDate: urlFilters.endDate || undefined,
        },
      });
      return { meta: data.meta, totalAll: data.total };
    },
    placeholderData: keepPreviousData,
    enabled: showNativeList,
  });

  const listQuery = useQuery({
    queryKey: [
      'invoices',
      'list',
      urlFilters.page,
      urlFilters.status,
      debouncedSearch,
      urlFilters.startDate,
      urlFilters.endDate,
    ],
    queryFn: async (): Promise<{ items: InvoiceDto[]; total: number }> => {
      const { data } = await api.get<InvoiceListResponse>('/invoices', {
        params: {
          page: urlFilters.page,
          limit: PAGE_SIZE,
          status: urlFilters.status === 'all' ? undefined : urlFilters.status,
          search: debouncedSearch.trim() || undefined,
          startDate: urlFilters.startDate || undefined,
          endDate: urlFilters.endDate || undefined,
        },
      });
      return { items: data.items, total: data.total };
    },
    enabled: showNativeList,
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: InvoiceStatus;
    }): Promise<void> => {
      setStatusChangingId(id);
      await api.patch(`/invoices/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      toast.success(invoicesT('toast.statusUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
    onSettled: () => {
      setStatusChangingId(null);
    },
  });

  const items = useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data?.items],
  );
  const total = listQuery.data?.total ?? 0;
  const listMeta = listMetaQuery.data?.meta;
  const listTotalAll = listMetaQuery.data?.totalAll;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkedOrderIds = useMemo(
    () => new Set(items.map((i) => i.orderId).filter((id): id is string => !!id)),
    [items],
  );

  const pageIds = useMemo(() => items.map((i) => i.id), [items]);
  const pageAllSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const pageSomeSelected = pageIds.some((id) => selectedIds.has(id));

  const issueEligibleCount = useMemo(
    () => countBulkIssueEligible(items, selectedIds),
    [items, selectedIds],
  );
  const markPaidEligibleCount = useMemo(
    () => countBulkMarkPaidEligible(items, selectedIds),
    [items, selectedIds],
  );

  const toggleRow = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePage = useCallback((): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, [pageAllSelected, pageIds]);

  const filterValues = useMemo(
    () => ({
      search: urlFilters.search,
      startDate: urlFilters.startDate,
      endDate: urlFilters.endDate,
    }),
    [urlFilters.search, urlFilters.startDate, urlFilters.endDate],
  );

  const handleFilterChange = (updates: Record<string, unknown>): void => {
    setUrlFilters({
      ...updates,
      page: 1,
    } as Partial<InvoiceUrlFilters>);
  };

  const openDetail = (id: string): void => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const handleInvoiceCreated = (invoice: InvoiceDto): void => {
    openDetail(invoice.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={
          showExternalBanner
            ? invoicesT('externalErp.pageDescription')
            : invoicesT('pageDescription')
        }
        context={navContextLine}
        actions={
          showNativeList ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setFromOrderOpen(true)}>
                <ShoppingCart className="mr-2 size-4" aria-hidden />
                {invoicesT('actions.fromOrder')}
              </Button>
              <Button onClick={() => setManualOpen(true)}>
                <Plus className="mr-2 size-4" aria-hidden />
                {invoicesT('actions.newInvoice')}
              </Button>
            </div>
          ) : null
        }
      />

      {accountingModeLoading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : null}

      {showExternalBanner ? <InvoicesExternalErpBanner /> : null}

      {showNativeList ? (
        <>
      <InvoicesStatsRow stats={statsQuery.data} isLoading={statsQuery.isLoading} />

      {!statsQuery.isLoading && (statsQuery.data?.overdueCount ?? 0) > 0 ? (
        <InvoicesOverdueAlert
          count={statsQuery.data?.overdueCount ?? 0}
          hideCta={urlFilters.status === 'OVERDUE'}
        />
      ) : null}

      <InvoicesStatusFilter
        value={urlFilters.status}
        meta={listMeta}
        totalAll={listTotalAll}
        isLoading={listMetaQuery.isLoading || listMetaQuery.isFetching}
        onChange={(status) => handleFilterChange({ status })}
      />

      <AdvancedFilters
        filters={INVOICE_FILTER_CONFIG}
        values={filterValues}
        onChange={handleFilterChange}
        onReset={() => resetUrlFilters()}
      />

      {listQuery.isLoading ? <TableSkeleton cols={8} rows={8} /> : null}
      {listQuery.isError ? (
        <QueryErrorAlert
          error={listQuery.error}
          onRetry={() => {
            void listQuery.refetch();
          }}
        />
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={invoicesT('empty.title')}
          description={invoicesT('empty.description')}
          actionSlot={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setFromOrderOpen(true)}>
                {invoicesT('actions.fromOrder')}
              </Button>
              <Button onClick={() => setManualOpen(true)}>
                {invoicesT('actions.newInvoice')}
              </Button>
            </div>
          }
        />
      ) : null}

      {selectedIds.size > 0 ? (
        <InvoicesBulkToolbar
          selectedCount={selectedIds.size}
          issueEligibleCount={issueEligibleCount}
          markPaidEligibleCount={markPaidEligibleCount}
          issuePending={issueMutation.isPending}
          markPaidPending={markPaidMutation.isPending}
          onIssue={() => {
            if (issueEligibleCount > 0) {
              setBulkIssueConfirmOpen(true);
            }
          }}
          onMarkPaid={() => {
            if (markPaidEligibleCount > 0) {
              setBulkMarkPaidConfirmOpen(true);
            }
          }}
          onClearSelection={clearSelection}
        />
      ) : null}

      <InvoicesBulkConfirmDialogs
          issueOpen={bulkIssueConfirmOpen}
          markPaidOpen={bulkMarkPaidConfirmOpen}
          issueCount={issueEligibleCount}
          markPaidCount={markPaidEligibleCount}
          pending={issueMutation.isPending || markPaidMutation.isPending}
          onIssueOpenChange={setBulkIssueConfirmOpen}
          onMarkPaidOpenChange={setBulkMarkPaidConfirmOpen}
          onConfirmIssue={() => {
            const ids = idsBulkIssueEligible(items, selectedIds);
            if (ids.length === 0) {
              return;
            }
            issueMutation.mutate(ids);
            setBulkIssueConfirmOpen(false);
          }}
          onConfirmMarkPaid={() => {
            const ids = idsBulkMarkPaidEligible(items, selectedIds);
            if (ids.length === 0) {
              return;
            }
            markPaidMutation.mutate(ids);
            setBulkMarkPaidConfirmOpen(false);
          }}
        />

      {listQuery.isSuccess && items.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <InvoicesTable
              items={items}
              getErpStatus={() => []}
              showErpColumn={false}
              onOpenDetail={openDetail}
              onStatusChange={(id, status) => statusMutation.mutate({ id, newStatus: status })}
              statusChangingId={statusChangingId}
              selectionEnabled
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onTogglePage={togglePage}
              pageAllSelected={pageAllSelected}
              pageSomeSelected={pageSomeSelected}
            />
            {totalPages > 1 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {invoicesT('pagination.summary', {
                    total: String(total),
                    page: String(urlFilters.page),
                    pages: String(totalPages),
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={urlFilters.page <= 1}
                    onClick={() => setUrlFilters({ page: urlFilters.page - 1 })}
                  >
                    {invoicesT('pagination.prev')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={urlFilters.page >= totalPages}
                    onClick={() => setUrlFilters({ page: urlFilters.page + 1 })}
                  >
                    {invoicesT('pagination.next')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <CreateManualInvoiceDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={handleInvoiceCreated}
      />
      <CreateFromOrderDialog
        open={fromOrderOpen}
        onOpenChange={setFromOrderOpen}
        linkedOrderIds={linkedOrderIds}
        onCreated={handleInvoiceCreated}
      />
      <InvoiceDetailSheet
        invoiceId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onErpSynced={() => {
          void queryClient.invalidateQueries({ queryKey: ['audit-log', 'erp-invoices'] });
        }}
      />
        </>
      ) : null}
    </div>
  );
}
