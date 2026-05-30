import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { DataTablePagination } from '@/components/DataTablePagination';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
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
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { PLATFORM_AUDIT_FETCH_LIMIT } from '@/lib/admin-list-constants';
import { normalizeAdminActivityItems } from '@/lib/admin-api-normalize';
import { adminOrgDetailUrl } from '@/lib/admin-org-detail-nav';
import {
  downloadAdminPlatformAuditCsv,
  downloadAdminPlatformAuditCsvFromServer,
} from '@/pages/admin/admin-platform-audit-csv';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import { formatAdminOrgDate } from '@/lib/admin-org-list-normalize';
import { api } from '@/lib/api';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { ADMIN_AUDIT_FILTER_DEFAULTS } from '@/pages/admin/admin-audit-filters.config';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type { AdminActivityItem } from '@/types/admin';

export function AdminPlatformAuditPage(): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [urlFilters, setUrlFilters] = useUrlFilters(ADMIN_AUDIT_FILTER_DEFAULTS);
  const { page, limit } = urlFilters;

  const query = useQuery({
    queryKey: ['admin', 'activity', 'full', PLATFORM_AUDIT_FETCH_LIMIT],
    queryFn: async (): Promise<AdminActivityItem[]> => {
      const { data } = await api.get<AdminActivityItem[]>('/admin/activity', {
        params: { limit: PLATFORM_AUDIT_FETCH_LIMIT },
      });
      return normalizeAdminActivityItems(data);
    },
  });

  const allRows = useMemo(() => query.data ?? [], [query.data]);
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageRows = useMemo(() => {
    const start = (page - 1) * limit;
    return allRows.slice(start, start + limit);
  }, [allRows, page, limit]);

  async function handleExportCsv(): Promise<void> {
    setExportingCsv(true);
    try {
      await downloadAdminPlatformAuditCsvFromServer();
      toast.success(t('admin.pages.auditLogs.toast.csvDownloaded'));
    } catch {
      if (allRows.length === 0) {
        toast.error(t('admin.pages.auditLogs.toast.exportEmpty'));
        return;
      }
      try {
        downloadAdminPlatformAuditCsv(allRows);
        toast.success(t('admin.pages.auditLogs.toast.csvDownloadedLocal'));
      } catch {
        toast.error(t('admin.pages.auditLogs.toast.exportFailed'));
      }
    } finally {
      setExportingCsv(false);
    }
  }

  const header = (
    <AdminPageHeader
      title={t('admin.pages.auditLogs.title')}
      description={t('admin.pages.auditLogs.description')}
      showBreadcrumbParent
      actions={
        <Button
          type="button"
          variant="outline"
          disabled={exportingCsv || query.isLoading}
          onClick={() => {
            void handleExportCsv();
          }}
        >
          {exportingCsv ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 size-4" aria-hidden />
          )}
          {t('admin.pages.auditLogs.exportCsv')}
        </Button>
      }
    />
  );

  if (query.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {header}
        <QueryErrorAlert
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <History className="mt-0.5 size-5 text-sky-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{t('admin.pages.auditLogs.cardTitle')}</CardTitle>
            <CardDescription>
              {t('admin.pages.auditLogs.cardDescriptionBefore')}{' '}
              <Link
                to="/audit-logs"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('admin.pages.auditLogs.tenantAuditLink')}
              </Link>{' '}
              {t('admin.pages.auditLogs.cardDescriptionAfter')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-4">
          {total === 0 ? (
            <div className="px-6 pb-2">
              <AdminListEmptyState
                hasActiveFilters={false}
                emptyTitle={t('admin.common.listEmpty.audit')}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.pages.auditLogs.table.date')}</TableHead>
                      <TableHead>{t('admin.pages.auditLogs.table.action')}</TableHead>
                      <TableHead>{t('admin.pages.auditLogs.table.resource')}</TableHead>
                      <TableHead>{t('admin.pages.auditLogs.table.actorOrg')}</TableHead>
                      <TableHead>{t('admin.pages.auditLogs.table.impersonation')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatAdminOrgDate(row.createdAt, 'd MMM yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatAuditLogAction(row.action)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAuditLogResourceDisplay(
                            row.resourceType,
                            row.resourceId,
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link
                            to={adminOrgDetailUrl(row.actorOrgId)}
                            className="font-medium text-sky-700 underline-offset-2 hover:underline"
                            title={row.actorOrgId}
                          >
                            {row.actorOrgName?.trim() || `${row.actorOrgId.slice(0, 8)}…`}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.impersonatedOrgId ? (
                            <Link
                              to={adminOrgDetailUrl(row.impersonatedOrgId)}
                              className="font-medium text-sky-700 underline-offset-2 hover:underline"
                              title={row.impersonatedOrgId}
                            >
                              {row.impersonatedOrgName?.trim() ||
                                `${row.impersonatedOrgId.slice(0, 8)}…`}
                            </Link>
                          ) : (
                            emDash
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4">
                <DataTablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  limit={limit}
                  onPageChange={(p) => {
                    setUrlFilters({ page: p });
                  }}
                  onLimitChange={(nextLimit) => {
                    setUrlFilters({ limit: nextLimit, page: 1 });
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
