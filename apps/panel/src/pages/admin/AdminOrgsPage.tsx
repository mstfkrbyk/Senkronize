import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus,
  Download,
  Loader2,
  MoreHorizontal,
  Shield,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTablePagination } from '@/components/DataTablePagination';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { OrgProductLineBadges } from '@/components/OrgProductLineBadges';
import { Badge } from '@/components/ui/badge';
import {
  adminAccountStatusLabel,
  adminAccountingModeLabel,
  adminOrgTypeLabel,
  adminPlanTierLabel,
  adminSubscriptionStatusLabel,
  ADMIN_PLAN_TIERS,
} from '@/lib/admin-i18n-labels';
import { asArray, normalizeAdminOrgListResponse } from '@/lib/admin-api-normalize';
import {
  adminAccountingModeBadgeClassSafe,
  formatAdminAccountingModeLabel,
  formatAdminOrgDate,
} from '@/lib/admin-org-list-normalize';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  adminOrganizationsByPartnerUrl,
  adminPartnerPageHash,
} from '@/lib/admin-partner-nav';
import {
  TRIAL_EXTEND_DAYS,
  TRIAL_EXTEND_REASON,
  trialEndsAtPlusDays,
} from '@/lib/admin-trial-extension';
import {
  downloadAdminOrgsCsv,
  fetchFilteredAdminOrgsForExport,
} from '@/pages/admin/admin-orgs-csv';
import { getOrgDeleteBlockedReason } from '@/pages/admin/admin-org-delete';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { ADMIN_ORG_FILTER_DEFAULTS } from '@/pages/admin/admin-orgs-filters.config';
import { AdminOrgProductFilterSelect } from '@/pages/admin/AdminOrgProductFilterSelect';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import {
  readAdminOrgProductFilterParam,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';
import { useEnterAdminOrg } from '@/pages/admin/useEnterAdminOrg';
import type { AdminOrgListResponse } from '@/types/admin';
import type { OrgPlanTier } from '@/types/auth';

const ACCOUNTING_MODE_FILTER_VALUES = ['NATIVE', 'EXTERNAL_ERP'] as const;
type OrgAccountingModeFilter = (typeof ACCOUNTING_MODE_FILTER_VALUES)[number];

function isOrgAccountingModeFilter(
  value: string,
): value is OrgAccountingModeFilter {
  return (ACCOUNTING_MODE_FILTER_VALUES as readonly string[]).includes(value);
}

export function AdminOrgsPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enterOrg, isPending: impersonatePending, isEnteringOrg } =
    useEnterAdminOrg();

  const productFilter = readAdminOrgProductFilterParam(searchParams.get('product'));
  const partnerFilterId = searchParams.get('partner')?.trim() || null;

  const [urlFilters, setUrlFilters] = useUrlFilters(ADMIN_ORG_FILTER_DEFAULTS);
  const { page, limit, search, plan: planFilter, status: statusFilter, accountingMode: accountingModeFilter } =
    urlFilters;
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setUrlFilters({ page: 1 });
  }, [partnerFilterId, setUrlFilters]);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const [planOpen, setPlanOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState<{
    id: string;
    name: string;
    current: OrgPlanTier | null;
  } | null>(null);
  const [newPlan, setNewPlan] = useState<OrgPlanTier>('GELISIM');
  const [planReason, setPlanReason] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [enterOpen, setEnterOpen] = useState(false);
  const [enterTarget, setEnterTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const { data: partnerOptions } = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data: res } = await api.get<
        Array<{ id: string; name: string; slug: string }>
      >('/admin/partners');
      return asArray<{ id: string; name: string; slug: string }>(res);
    },
    staleTime: 60_000,
  });

  const partnerFilterLabel =
    partnerFilterId != null
      ? (partnerOptions?.find((p) => p.id === partnerFilterId)?.name ??
        t('admin.common.selectedPartner'))
      : null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'admin',
      'organizations',
      page,
      limit,
      search,
      planFilter,
      statusFilter,
      productFilter,
      accountingModeFilter,
      partnerFilterId,
    ],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        {
          params: {
            page,
            limit,
            search: search || undefined,
            plan: planFilter === 'all' ? undefined : planFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            product: productFilter === 'all' ? undefined : productFilter,
            accountingMode:
              accountingModeFilter === 'all' ? undefined : accountingModeFilter,
            partner: partnerFilterId ?? undefined,
          },
        },
      );
      return normalizeAdminOrgListResponse(res);
    },
  });

  function clearPartnerFilter(): void {
    setUrlFilters({ page: 1 });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('partner');
        return next;
      },
      { replace: true },
    );
  }

  function setProductFilter(value: AdminOrgProductFilterValue): void {
    setUrlFilters({ page: 1 });
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

  const suspendMutation = useMutation({
    mutationFn: async (payload: { id: string; reason: string }) => {
      await api.post(`/admin/organizations/${payload.id}/suspend`, {
        reason: payload.reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.organizations.toast.suspended'));
      setSuspendOpen(false);
      setSuspendReason('');
      setSuspendTargetId(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/organizations/${id}/unsuspend`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.organizations.toast.unsuspended'));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const extendTrialMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      trialEndsAt: string | null;
    }) => {
      await api.patch(`/admin/organizations/${payload.id}/subscription`, {
        trialEndsAt: trialEndsAtPlusDays(payload.trialEndsAt, TRIAL_EXTEND_DAYS),
        reason: TRIAL_EXTEND_REASON,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.organizations.toast.trialExtended'));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (payload: { id: string; plan: OrgPlanTier; reason: string }) => {
      await api.patch(`/admin/organizations/${payload.id}/plan`, {
        plan: payload.plan,
        reason: payload.reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success(t('admin.organizations.toast.planUpdated'));
      setPlanOpen(false);
      setPlanReason('');
      setPlanTarget(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/organizations/${id}`);
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.organizations.toast.deleted'));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  async function handleExportCsv(): Promise<void> {
    setExportingCsv(true);
    try {
      const rows = await fetchFilteredAdminOrgsForExport({
        search,
        plan: planFilter,
        status: statusFilter,
        product: productFilter,
        accountingMode: accountingModeFilter,
        partnerId: partnerFilterId,
      });
      if (rows.length === 0) {
        toast.error(t('admin.organizations.toast.exportEmpty'));
        return;
      }
      downloadAdminOrgsCsv(rows, undefined, t);
      toast.success(t('admin.organizations.toast.csvDownloaded'));
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExportingCsv(false);
    }
  }

  const total = data?.total ?? 0;
  const effectiveLimit = data?.limit ?? limit;
  const totalPages = Math.max(1, Math.ceil(total / effectiveLimit));
  const hasActiveFilters =
    search.trim().length > 0 ||
    planFilter !== 'all' ||
    statusFilter !== 'all' ||
    accountingModeFilter !== 'all' ||
    productFilter !== 'all' ||
    partnerFilterId != null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.organizations.title')}
        description={t('admin.pages.organizations.description')}
        actions={
          <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={exportingCsv}
              onClick={() => {
                void handleExportCsv();
              }}
            >
              {exportingCsv ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 size-4" aria-hidden />
              )}
              {t('admin.pages.organizations.exportCsv')}
            </Button>
            <form
              className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                setUrlFilters({ page: 1, search: searchDraft.trim() });
              }}
            >
              <Input
                placeholder={t('admin.organizations.searchPlaceholder')}
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                }}
                className="sm:flex-1"
              />
              <Button type="submit">{t('admin.common.search')}</Button>
            </form>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
      <div className="flex flex-wrap gap-3">
        <AdminOrgProductFilterSelect
          value={productFilter}
          onValueChange={setProductFilter}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('admin.common.accountingMode')}</Label>
          <Select
            value={accountingModeFilter}
            onValueChange={(v) => {
              setUrlFilters({
                page: 1,
                accountingMode:
                  v === 'all' ? 'all' : isOrgAccountingModeFilter(v) ? v : 'all',
              });
            }}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder={t('admin.common.accountingMode')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.common.all')}</SelectItem>
              <SelectItem value="NATIVE">
                {adminAccountingModeLabel('NATIVE', t)}
              </SelectItem>
              <SelectItem value="EXTERNAL_ERP">
                {adminAccountingModeLabel('EXTERNAL_ERP', t)}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('admin.common.plan')}</Label>
          <Select
            value={planFilter}
            onValueChange={(v) => {
              setUrlFilters({ page: 1, plan: v });
            }}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder={t('admin.common.plan')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.common.all')}</SelectItem>
              {ADMIN_PLAN_TIERS.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {adminPlanTierLabel(plan, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('admin.common.status')}</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setUrlFilters({ page: 1, status: v });
            }}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder={t('admin.common.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.common.all')}</SelectItem>
              <SelectItem value="AKTIF">{t('admin.orgListStatus.AKTIF')}</SelectItem>
              <SelectItem value="DENEME">{t('admin.orgListStatus.DENEME')}</SelectItem>
              <SelectItem value="ASKIDA">{t('admin.orgListStatus.ASKIDA')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {partnerFilterId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span>
            {t('admin.organizations.partnerFilter')}{' '}
            <span className="font-medium">{partnerFilterLabel}</span>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={clearPartnerFilter}>
            {t('admin.organizations.clearPartnerFilter')}
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link to={`/admin/partners${adminPartnerPageHash(partnerFilterId)}`}>
              {t('admin.organizations.goToPartnerRow')}
            </Link>
          </Button>
        </div>
      ) : null}

      {isLoading ? <TableSkeleton rows={8} cols={9} /> : null}

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
          hasActiveFilters={hasActiveFilters}
          emptyTitle={t('admin.common.listEmpty.organizations')}
        />
      ) : null}

      {!isLoading && !isError && data && data.orgs.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.organizations.table.organization')}</TableHead>
                  <TableHead>{t('admin.organizations.table.partner')}</TableHead>
                  <TableHead>{t('admin.organizations.table.accounting')}</TableHead>
                  <TableHead>{t('admin.organizations.table.plan')}</TableHead>
                  <TableHead>{t('admin.organizations.table.status')}</TableHead>
                  <TableHead className="text-right">{t('admin.organizations.table.orders')}</TableHead>
                  <TableHead>{t('admin.organizations.table.registered')}</TableHead>
                  <TableHead>{t('admin.organizations.table.lastActivity')}</TableHead>
                  <TableHead className="w-[1%] text-right">{t('admin.organizations.table.menu')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{org.name}</span>
                          <Badge variant="outline" className="text-xs font-normal">
                            {adminOrgTypeLabel('DIRECT', t)}
                          </Badge>
                        </div>
                        {org.taxNumber ? (
                          <div className="text-xs text-muted-foreground">
                            {t('admin.common.taxNumber', { value: org.taxNumber })}
                          </div>
                        ) : null}
                        <OrgProductLineBadges
                          orgProducts={org.orgProducts}
                          className="mt-1"
                        />
                      </TableCell>
                      <TableCell>
                        {org.activePartners.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {org.activePartners.map((p) => (
                              <li key={p.id}>
                                <Link
                                  to={`/admin/partners${adminPartnerPageHash(p.id)}`}
                                  className="text-sky-700 underline-offset-2 hover:underline"
                                >
                                  {p.name}
                                </Link>
                                {' · '}
                                <Link
                                  to={adminOrganizationsByPartnerUrl(p.id)}
                                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                >
                                  {t('admin.common.partnerClients')}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">{t('admin.common.emDash')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-normal',
                            adminAccountingModeBadgeClassSafe(org.accountingMode),
                          )}
                        >
                          {formatAdminAccountingModeLabel(org.accountingMode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {org.subscription ? (
                          <Badge variant="secondary">
                            {adminPlanTierLabel(org.subscription.plan, t)}
                          </Badge>
                        ) : (
                          t('admin.common.emDash')
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {org.suspended ? (
                            <Badge variant="destructive">
                              {adminAccountStatusLabel(true, t)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                              {adminAccountStatusLabel(false, t)}
                            </Badge>
                          )}
                          {org.subscription ? (
                            <Badge variant="outline">
                              {adminSubscriptionStatusLabel(org.subscription.status, t)}
                              {org.subscription.status === 'TRIAL' &&
                              org.subscription.trialEndsAt
                                ? ` · ${formatAdminOrgDate(org.subscription.trialEndsAt, 'd MMM')}`
                                : ''}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(org._count.orders ?? 0).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatAdminOrgDate(org.createdAt, 'd MMM yyyy')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatAdminOrgDate(org.lastActivityAt, 'd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" aria-label={t('admin.common.menuAria')}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(`/admin/organizations/${org.id}`);
                              }}
                            >
                              {t('admin.common.detail')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPlanTarget({
                                  id: org.id,
                                  name: org.name,
                                  current: org.subscription?.plan ?? null,
                                });
                                setNewPlan(org.subscription?.plan ?? 'GELISIM');
                                setPlanOpen(true);
                              }}
                            >
                              {t('admin.organizations.actions.changePlan')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                !org.subscription ||
                                org.subscription.status !== 'TRIAL' ||
                                extendTrialMutation.isPending
                              }
                              onClick={() => {
                                extendTrialMutation.mutate({
                                  id: org.id,
                                  trialEndsAt: org.subscription?.trialEndsAt ?? null,
                                });
                              }}
                            >
                              <CalendarPlus className="mr-2 size-4" aria-hidden />
                              {t('admin.organizations.actions.extendTrial')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {org.suspended ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  unsuspendMutation.mutate(org.id);
                                }}
                              >
                                {t('admin.organizations.actions.unsuspend')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSuspendTargetId(org.id);
                                  setSuspendOpen(true);
                                }}
                              >
                                {t('admin.organizations.actions.suspend')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setEnterTarget({ id: org.id, name: org.name });
                                setEnterOpen(true);
                              }}
                              disabled={impersonatePending}
                            >
                              {isEnteringOrg(org.id) ? (
                                <Loader2
                                  className="mr-2 size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <UserCircle2 className="mr-2 size-4" aria-hidden />
                              )}
                              {t('admin.organizations.actions.enterAccount')}
                            </DropdownMenuItem>
                            {!getOrgDeleteBlockedReason({ slug: org.slug }, t) ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setDeleteTarget({ id: org.id, name: org.name });
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 size-4" aria-hidden />
                                  {t('admin.common.delete')}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={effectiveLimit}
            onPageChange={(p) => {
              setUrlFilters({ page: p });
            }}
            onLimitChange={(nextLimit) => {
              setUrlFilters({ limit: nextLimit, page: 1 });
            }}
          />
        </>
      ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={enterOpen}
        onOpenChange={(open) => {
          setEnterOpen(open);
          if (!open) {
            setEnterTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.organizations.enterOrg.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enterTarget
                ? t('admin.organizations.enterOrg.confirmDescription', {
                    name: enterTarget.name,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.common.dismiss')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!enterTarget || impersonatePending}
              onClick={() => {
                if (!enterTarget) {
                  return;
                }
                void enterOrg(enterTarget.id, enterTarget.name);
                setEnterOpen(false);
                setEnterTarget(null);
              }}
            >
              {enterTarget && isEnteringOrg(enterTarget.id) ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.organizations.enterOrg.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5" aria-hidden />
              {t('admin.organizations.dialogs.suspendTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">{t('admin.common.reason')}</Label>
            <Textarea
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => {
                setSuspendReason(e.target.value);
              }}
              placeholder={t('admin.organizations.dialogs.suspendReasonPlaceholder')}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuspendOpen(false)}>
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                suspendMutation.isPending ||
                !suspendTargetId ||
                suspendReason.trim().length === 0
              }
              onClick={() => {
                if (!suspendTargetId) {
                  return;
                }
                suspendMutation.mutate({
                  id: suspendTargetId,
                  reason: suspendReason.trim(),
                });
              }}
            >
              {suspendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                t('admin.organizations.dialogs.suspendConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.organizations.dialogs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t('admin.organizations.dialogs.deleteDescription', {
                    name: deleteTarget.name,
                  })
                : t('admin.organizations.dialogs.deleteDescriptionGeneric')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrgMutation.isPending || !deleteTarget}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) {
                  return;
                }
                void deleteOrgMutation.mutateAsync(deleteTarget.id);
              }}
            >
              {deleteOrgMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.common.yesDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.organizations.dialogs.changePlanTitle')}</DialogTitle>
          </DialogHeader>
          {planTarget ? (
            <p className="text-sm text-muted-foreground">
              {planTarget.name}
              {planTarget.current ? (
                <>
                  {' '}
                  —{' '}
                  {t('admin.common.currentPlan', {
                    plan: adminPlanTierLabel(planTarget.current, t),
                  })}
                </>
              ) : null}
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('admin.common.newPlan')}</Label>
              <Select
                value={newPlan}
                onValueChange={(v) => {
                  setNewPlan(v as OrgPlanTier);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_PLAN_TIERS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {adminPlanTierLabel(plan, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-reason">{t('admin.common.reason')}</Label>
              <Textarea
                id="plan-reason"
                value={planReason}
                onChange={(e) => {
                  setPlanReason(e.target.value);
                }}
                rows={3}
                placeholder={t('admin.organizations.dialogs.changePlanNotePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={
                changePlanMutation.isPending ||
                !planTarget ||
                planReason.trim().length === 0
              }
              onClick={() => {
                if (!planTarget) {
                  return;
                }
                changePlanMutation.mutate({
                  id: planTarget.id,
                  plan: newPlan,
                  reason: planReason.trim(),
                });
              }}
            >
              {changePlanMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                t('admin.common.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
