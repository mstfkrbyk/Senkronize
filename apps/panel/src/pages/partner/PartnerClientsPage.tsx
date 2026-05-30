import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Loader2, LogIn, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { PartnerClientBadges } from '@/components/PartnerClientBadges';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { resolvePartnerSubPageTitle } from '@/lib/partner-nav-context';

import { InviteClientDialog } from './InviteClientDialog';
import { PartnerPageHeader } from './PartnerPageHeader';
import { useCommissionReport, useMyClients } from './hooks/usePartner';
import { partnerDemoClientHint } from './partner-demo-client-hints';
import { downloadPartnerClientsCsv } from './partner-clients-csv';
import {
  buildPartnerClientRows,
  filterPartnerClientRows,
  sortPartnerClientRows,
  type ClientSort,
  type PartnerClientTableRow,
  type PlanFilter,
  type StatusFilter,
} from './partner-client-rows';
import { formatTryPlain, planLabel } from './partner-utils';
import { useEnterPartnerClient } from './useEnterPartnerClient';

function stopRowActivation(e: MouseEvent | KeyboardEvent): void {
  e.stopPropagation();
}

function clientRowActivationProps(
  row: Pick<PartnerClientTableRow, 'canImpersonate' | 'clientOrgId' | 'name'>,
  enterClient: (clientOrgId: string, clientName: string) => Promise<void>,
  enterClientAria: string,
): {
  role: 'button';
  tabIndex: 0;
  'aria-label': string;
  className: string;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => void;
} | null {
  if (!row.canImpersonate || row.clientOrgId == null) {
    return null;
  }
  const clientOrgId = row.clientOrgId;
  const activate = (): void => {
    void enterClient(clientOrgId, row.name);
  };
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': enterClientAria,
    className:
      'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    onClick: activate,
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') {
        return;
      }
      e.preventDefault();
      activate();
    },
  };
}

export function PartnerClientsPage(): ReactElement {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const pageTitle =
    resolvePartnerSubPageTitle(pathname, t) ?? t('partner.nav.clients');
  const pageDescription = t('partner.pages.clients.description');
  usePageTitle(pageTitle);

  const now = useMemo(() => new Date(), []);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<ClientSort>('name-asc');

  const clients = useMyClients();
  const report = useCommissionReport(now.getFullYear(), now.getMonth() + 1);
  const { enterClient, isEnteringClient } = useEnterPartnerClient();

  const reportByOrg = useMemo(() => {
    const map = new Map<
      string,
      { plan: string; monthlyRevenue: number; commissionAmount: number }
    >();
    for (const r of report.data?.rows ?? []) {
      map.set(r.clientOrgId, {
        plan: r.plan,
        monthlyRevenue: r.monthlyFeeTRY,
        commissionAmount: r.commissionAmountTRY,
      });
    }
    return map;
  }, [report.data?.rows]);

  const invitePendingLabel = t('partner.pages.clients.invitePending');

  const allRows = useMemo(() => {
    if (!clients.data) {
      return [];
    }
    return buildPartnerClientRows(clients.data, reportByOrg, invitePendingLabel);
  }, [clients.data, reportByOrg, invitePendingLabel]);

  const filtered = useMemo(() => {
    const matched = filterPartnerClientRows(allRows, {
      search,
      planFilter,
      statusFilter,
    });
    return sortPartnerClientRows(matched, sort);
  }, [allRows, search, planFilter, statusFilter, sort]);

  const loading = clients.isLoading || report.isLoading;
  const isError = clients.isError || report.isError;
  const error = clients.error ?? report.error;

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.error(
        allRows.length === 0
          ? t('partner.pages.clients.exportEmptyAll')
          : t('partner.pages.clients.exportEmptyFiltered'),
      );
      return;
    }
    downloadPartnerClientsCsv(filtered, now);
    toast.success(t('partner.pages.clients.exportCsvSuccess'));
  }, [allRows.length, filtered, now, t]);

  const inviteTrigger = (
    <Button type="button">{t('partner.pages.clients.inviteClient')}</Button>
  );

  const headerActions = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={loading || filtered.length === 0}
        onClick={exportCsv}
      >
        <Download className="mr-2 size-4" aria-hidden />
        {t('partner.pages.clients.exportCsv')}
      </Button>
      <InviteClientDialog trigger={inviteTrigger} />
    </>
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t('partner.pages.clients.loadingAria')}>
        <PartnerPageHeader
          title={pageTitle}
          description={pageDescription}
          actions={headerActions}
        />
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
            <Skeleton className="h-10 min-w-[200px] flex-1" />
            <Skeleton className="h-10 w-[160px]" />
            <Skeleton className="h-10 w-[160px]" />
            <Skeleton className="h-10 w-[220px]" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TableSkeleton rows={6} cols={9} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PartnerPageHeader
          title={pageTitle}
          description={pageDescription}
          actions={headerActions}
        />
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void clients.refetch();
            void report.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PartnerPageHeader
        title={pageTitle}
        description={pageDescription}
        actions={headerActions}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder={t('partner.pages.clients.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={planFilter}
            onValueChange={(v) => setPlanFilter(v as PlanFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('partner.pages.clients.table.plan')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('partner.pages.clients.filterPlanAll')}
              </SelectItem>
              <SelectItem value="BASLANGIC">{planLabel('BASLANGIC')}</SelectItem>
              <SelectItem value="GELISIM">{planLabel('GELISIM')}</SelectItem>
              <SelectItem value="PRO">{planLabel('PRO')}</SelectItem>
              <SelectItem value="KURUMSAL">{planLabel('KURUMSAL')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('partner.pages.clients.table.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('partner.pages.clients.filterStatusAll')}
              </SelectItem>
              <SelectItem value="ACTIVE">
                {t('partner.pages.clients.filterStatusActive')}
              </SelectItem>
              <SelectItem value="PENDING">
                {t('partner.pages.clients.filterStatusPending')}
              </SelectItem>
              <SelectItem value="SUSPENDED">
                {t('partner.pages.clients.filterStatusSuspended')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as ClientSort)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t('partner.pages.clients.sortLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">
                {t('partner.pages.clients.sortNameAsc')}
              </SelectItem>
              <SelectItem value="name-desc">
                {t('partner.pages.clients.sortNameDesc')}
              </SelectItem>
              <SelectItem value="orders30d-desc">
                {t('partner.pages.clients.sortOrdersDesc')}
              </SelectItem>
              <SelectItem value="orders30d-asc">
                {t('partner.pages.clients.sortOrdersAsc')}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {allRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('partner.pages.clients.emptyTitle')}
          description={t('partner.pages.clients.emptyDescription')}
          actionSlot={<InviteClientDialog trigger={inviteTrigger} />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('partner.pages.clients.emptyFilteredTitle')}
          description={t('partner.pages.clients.emptyFilteredDescription')}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partner.pages.clients.table.company')}</TableHead>
                <TableHead>{t('partner.pages.clients.table.plan')}</TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.clients.table.orders30d')}
                </TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.clients.table.monthlyRevenue')}
                </TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.clients.table.commissionPct')}
                </TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.clients.table.commission')}
                </TableHead>
                <TableHead>{t('partner.pages.clients.table.status')}</TableHead>
                <TableHead>{t('partner.pages.clients.table.registered')}</TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.clients.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const demoHint = partnerDemoClientHint(row.slug);
                const enterClientAria = t('partner.pages.clients.enterClientAria', {
                  name: row.name,
                });
                const rowActivation = clientRowActivationProps(
                  row,
                  enterClient,
                  enterClientAria,
                );
                const registeredLabel = row.registeredAt
                  ? format(new Date(row.registeredAt), 'd MMM yyyy', { locale: tr })
                  : '—';

                return (
                  <TableRow key={row.relationshipId} {...(rowActivation ?? {})}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <p className="text-xs text-muted-foreground">@{row.slug}</p>
                      {demoHint ? (
                        <p className="text-xs text-muted-foreground">{demoHint}</p>
                      ) : null}
                      <PartnerClientBadges
                        orgProducts={row.orgProducts}
                        accountingMode={row.accountingMode}
                        className="mt-1"
                      />
                    </TableCell>
                    <TableCell>{planLabel(row.plan)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orders30d}
                    </TableCell>
                    <TableCell className="text-right">
                      ₺{formatTryPlain(row.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="text-right">{row.commissionPct}</TableCell>
                    <TableCell className="text-right">
                      ₺{formatTryPlain(row.commissionAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}
                      >
                        {t(`partner.status.${row.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {registeredLabel}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={stopRowActivation}
                      onKeyDown={stopRowActivation}
                    >
                      {row.canImpersonate && row.clientOrgId ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isEnteringClient(row.clientOrgId)}
                          aria-label={enterClientAria}
                          onClick={(e) => {
                            e.stopPropagation();
                            void enterClient(row.clientOrgId!, row.name);
                          }}
                        >
                          {isEnteringClient(row.clientOrgId) ? (
                            <Loader2
                              className="mr-1 size-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <LogIn className="mr-1 size-4" aria-hidden />
                          )}
                          {isEnteringClient(row.clientOrgId)
                            ? t('partner.pages.clients.enteringClient')
                            : t('partner.pages.clients.enterClient')}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
