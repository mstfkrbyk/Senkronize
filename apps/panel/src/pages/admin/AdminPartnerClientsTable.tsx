import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { DataTablePagination } from '@/components/DataTablePagination';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { OrgProductLineBadges } from '@/components/OrgProductLineBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminAccountStatusLabel,
  adminAccountingModeLabel,
  adminPlanTierLabel,
  adminSubscriptionStatusLabel,
} from '@/lib/admin-i18n-labels';
import { adminOrgDetailUrl } from '@/lib/admin-org-detail-nav';
import type { AdminOrgProductFilterValue } from '@/lib/admin-org-product-filter';
import { adminOrganizationsByPartnerUrl } from '@/lib/admin-partner-nav';
import { normalizeAdminOrgListResponse } from '@/lib/admin-api-normalize';
import {
  adminAccountingModeBadgeClassSafe,
} from '@/lib/admin-org-list-normalize';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { downloadAdminPartnerClientsCsv } from '@/pages/admin/admin-partner-clients-csv';
import { partnerDemoClientHint } from '@/pages/partner/partner-demo-client-hints';
import type { AdminOrgListResponse } from '@/types/admin';

const PAGE_SIZE = 50;

interface Props {
  partnerOrgId: string;
  partnerName?: string | null;
  productFilter?: AdminOrgProductFilterValue;
}

export function AdminPartnerClientsTable({
  partnerOrgId,
  partnerName,
  productFilter = 'all',
}: Props): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [partnerOrgId, productFilter]);

  const displayPartnerName =
    typeof partnerName === 'string' && partnerName.trim().length > 0
      ? partnerName.trim()
      : t('admin.pages.partnerClients.defaultPartnerName');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'admin',
      'organizations',
      'partner-clients',
      partnerOrgId,
      productFilter,
      page,
      limit,
    ],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        {
          params: {
            page,
            limit,
            partner: partnerOrgId,
            product: productFilter === 'all' ? undefined : productFilter,
          },
        },
      );
      return normalizeAdminOrgListResponse(res);
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function handleExportCsv(): void {
    if (!data || data.orgs.length === 0) {
      toast.error(t('admin.pages.partnerClients.toast.exportEmpty'));
      return;
    }
    downloadAdminPartnerClientsCsv(data.orgs, undefined, t);
    toast.success(t('admin.pages.partnerClients.toast.exportCsvSuccess'));
  }

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-sky-950">
            {t('admin.pages.partnerClients.title', { name: displayPartnerName })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('admin.pages.partnerClients.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isLoading || !data || data.orgs.length === 0}
            onClick={handleExportCsv}
          >
            <Download className="mr-1.5 size-3.5" aria-hidden />
            {t('admin.pages.partnerClients.exportCsv')}
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={adminOrganizationsByPartnerUrl(partnerOrgId, productFilter)}>
              {t('admin.pages.partnerClients.listAll')}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? <TableSkeleton rows={4} cols={5} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && data && data.orgs.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={productFilter !== 'all'}
          emptyTitle={t('admin.pages.partnerClients.empty')}
          icon={Building2}
        />
      ) : null}

      {!isLoading && !isError && data && data.orgs.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.pages.partnerClients.table.organization')}</TableHead>
                <TableHead>{t('admin.pages.partnerClients.table.accounting')}</TableHead>
                <TableHead>{t('admin.pages.partnerClients.table.plan')}</TableHead>
                <TableHead>{t('admin.pages.partnerClients.table.status')}</TableHead>
                <TableHead className="w-[1%] text-right">
                  {t('admin.pages.partnerClients.table.detail')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {
                data.orgs.map((org) => {
                  const demoHint = partnerDemoClientHint(org.slug, t);
                  const orgName = org.name?.trim() || emDash;
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <Link
                          to={adminOrgDetailUrl(org.id)}
                          className="font-medium text-sky-700 underline-offset-2 hover:underline"
                        >
                          {orgName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          @{org.slug?.trim() || emDash}
                        </div>
                        {demoHint ? (
                          <p className="mt-1 text-xs text-sky-800">{demoHint}</p>
                        ) : null}
                        <OrgProductLineBadges
                          orgProducts={org.orgProducts}
                          className="mt-1"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-normal',
                            adminAccountingModeBadgeClassSafe(org.accountingMode),
                          )}
                        >
                          {adminAccountingModeLabel(org.accountingMode, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {org.subscription ? (
                          <Badge variant="secondary">
                            {adminPlanTierLabel(org.subscription.plan, t)}
                          </Badge>
                        ) : (
                          emDash
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-sky-900"
                          >
                            {t('admin.partner.clientStatus.ACTIVE')}
                          </Badge>
                          <Badge
                            variant={org.suspended ? 'destructive' : 'outline'}
                            className={
                              org.suspended
                                ? undefined
                                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            }
                          >
                            {adminAccountStatusLabel(org.suspended, t)}
                          </Badge>
                          {org.subscription ? (
                            <Badge variant="outline">
                              {adminSubscriptionStatusLabel(org.subscription.status, t)}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="ghost" asChild>
                          <Link to={adminOrgDetailUrl(org.id)}>
                            {t('admin.pages.partnerClients.table.detail')}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              }
            </TableBody>
          </Table>
          </div>
          {total > PAGE_SIZE ? (
            <div className="px-4 pb-4">
              <DataTablePagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
