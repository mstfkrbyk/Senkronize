import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { OrgProductLineBadges } from '@/components/OrgProductLineBadges';
import { Badge } from '@/components/ui/badge';
import { asArray } from '@/lib/admin-api-normalize';
import {
  adminAccountingModeBadgeClassSafe,
  formatAdminOrgDate,
} from '@/lib/admin-org-list-normalize';
import {
  adminAccountingModeLabel,
  ADMIN_SUBSCRIPTION_STATUSES,
  adminPlanTierLabel,
  adminSubscriptionStatusLabel,
} from '@/lib/admin-i18n-labels';
import {
  readAdminOrgProductFilterParam,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';
import { adminOrgDetailUrl } from '@/lib/admin-org-detail-nav';
import { api } from '@/lib/api';
import { productSelectionFromOrgProducts } from '@/lib/product-selection';
import { cn } from '@/lib/utils';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { ADMIN_SUBSCRIPTION_FILTER_DEFAULTS } from '@/pages/admin/admin-subscriptions-filters.config';
import { AdminOrgProductFilterSelect } from '@/pages/admin/AdminOrgProductFilterSelect';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type { AdminSubscriptionRow, SubStatus } from '@/types/admin';

/**
 * Abonelik listesi `/admin/subscriptions` en fazla 100 kayıt döner (sunucu `take: 100`).
 * Durum filtresi API'de uygulanır; ürün hattı API'de desteklenmediği için istemcide filtrelenir.
 * Tam sunucu sayfalaması liste büyüdüğünde backend'e `page`/`limit` eklenerek açılabilir.
 */
export function AdminSubscriptionsPage(): ReactElement {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const productFilter = readAdminOrgProductFilterParam(searchParams.get('product'));
  const [urlFilters, setUrlFilters] = useUrlFilters(ADMIN_SUBSCRIPTION_FILTER_DEFAULTS);
  const status = urlFilters.status;

  function setProductFilter(value: AdminOrgProductFilterValue): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('product');
        } else {
          next.set('product', value);
        }
        return next;
      },
      { replace: true },
    );
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'subscriptions', status],
    queryFn: async (): Promise<AdminSubscriptionRow[]> => {
      const { data: res } = await api.get<AdminSubscriptionRow[]>(
        '/admin/subscriptions',
        {
          params:
            status === 'ALL'
              ? undefined
              : {
                  status,
                },
        },
      );
      return asArray(res);
    },
  });

  const filteredRows = useMemo(() => {
    const rows = data ?? [];
    if (productFilter === 'all') {
      return rows;
    }
    return rows.filter(
      (row) =>
        productSelectionFromOrgProducts(row.organization.orgProducts) ===
        productFilter,
    );
  }, [data, productFilter]);

  const hasActiveFilters = status !== 'ALL' || productFilter !== 'all';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.subscriptions.title')}
        description={t('admin.pages.subscriptions.description')}
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
      <div className="flex flex-wrap gap-3">
        <AdminOrgProductFilterSelect
          value={productFilter}
          onValueChange={setProductFilter}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t('admin.pages.subscriptions.statusLabel')}
          </Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setUrlFilters({ status: v as SubStatus | 'ALL' });
            }}
          >
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('admin.common.all')}</SelectItem>
              {ADMIN_SUBSCRIPTION_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {adminSubscriptionStatusLabel(value, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <TableSkeleton rows={8} cols={7} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && data && filteredRows.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={hasActiveFilters}
          emptyTitle={t('admin.common.listEmpty.subscriptions')}
          emptyDescription={t('admin.pages.subscriptions.emptyFiltered')}
        />
      ) : null}

      {!isLoading && !isError && data && filteredRows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.pages.subscriptions.table.organization')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.productLines')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.accountingMode')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.plan')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.status')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.periodStart')}</TableHead>
                <TableHead>{t('admin.pages.subscriptions.table.periodEnd')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      to={adminOrgDetailUrl(row.organization.id)}
                      className="font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {row.organization.name}
                    </Link>
                    {row.organization.suspended ? (
                      <Badge variant="destructive" className="mt-1">
                        {t('admin.pages.subscriptions.orgSuspended')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <OrgProductLineBadges
                      orgProducts={row.organization.orgProducts}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-normal',
                        adminAccountingModeBadgeClassSafe(
                          row.organization.accountingMode,
                        ),
                      )}
                    >
                      {adminAccountingModeLabel(
                        row.organization.accountingMode,
                        t,
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {adminPlanTierLabel(row.plan, t)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {adminSubscriptionStatusLabel(row.status, t)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminOrgDate(row.currentPeriodStart, 'd MMM yyyy')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminOrgDate(row.currentPeriodEnd, 'd MMM yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
