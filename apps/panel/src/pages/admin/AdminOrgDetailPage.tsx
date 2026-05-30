import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { adminAccountingModeBadgeClass } from '@/lib/admin-accounting-mode';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import {
  asArray,
  normalizeAdminOrgNotes,
  normalizeAdminOrganizationDetail,
} from '@/lib/admin-api-normalize';
import {
  adminAccountStatusLabel,
  adminAccountingModeLabel,
  adminNoSubscriptionLabel,
  adminOrgTypeLabel,
  adminPaymentStatusLabel,
  adminPlanTierLabel,
  adminSubscriptionStatusLabel,
  adminUserRoleLabel,
} from '@/lib/admin-i18n-labels';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  adminOrganizationsByPartnerUrl,
  adminPartnerPageHash,
} from '@/lib/admin-partner-nav';
import {
  adminOrgDetailUrl,
  isAdminOrgDetailTab,
  type AdminOrgDetailTab,
} from '@/lib/admin-org-detail-nav';
import { isAxiosError } from 'axios';
import { resolveAccountingMode } from '@/lib/accounting-mode';
import {
  isKnownOrderStatus,
  orderStatusLabel,
  orderStatusTone,
} from '@/lib/order-status';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import { OrgProductLineBadges } from '@/components/OrgProductLineBadges';
import { getOrgDeleteBlockedReason } from '@/pages/admin/admin-org-delete';
import { AdminOrgSettingsPanel } from '@/pages/admin/AdminOrgSettingsPanel';
import { AdminOrgConnectionsPanel } from '@/pages/admin/AdminOrgConnectionsPanel';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type {
  AdminActivitySummary,
  AdminOrgDetailPartnerLink,
  AdminOrgNote,
  AdminOrganizationDetailResponse,
} from '@/types/admin';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

const DEFAULT_ORG_DETAIL_TAB: AdminOrgDetailTab = 'general';

function formatSafeDate(
  iso: string | null | undefined,
  pattern: string,
  empty: string,
): string {
  if (!iso) {
    return empty;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return empty;
  }
  try {
    return format(d, pattern, { locale: tr });
  } catch {
    return empty;
  }
}

export function AdminOrgDetailPage(): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const orgTypeLabel = (type: string): string => adminOrgTypeLabel(type, t);
  const userRoleLabel = (role: string): string => adminUserRoleLabel(role, t);
  const subscriptionStatusLabel = (status: string): string =>
    adminSubscriptionStatusLabel(status, t);
  const planTierLabel = (plan: string): string => adminPlanTierLabel(plan, t);
  const paymentStatusLabel = (status: string): string =>
    adminPaymentStatusLabel(status, t);
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editInfoDraft, setEditInfoDraft] = useState({
    name: '',
    taxId: '',
    taxOffice: '',
    city: '',
    address: '',
    website: '',
  });

  const tabParam = searchParams.get('tab');
  const activeTab = isAdminOrgDetailTab(tabParam)
    ? tabParam
    : DEFAULT_ORG_DETAIL_TAB;

  const setActiveTab = (tab: string): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === DEFAULT_ORG_DETAIL_TAB) {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true },
    );
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'organization', orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<AdminOrganizationDetailResponse> => {
      const { data: res } = await api.get<AdminOrganizationDetailResponse>(
        `/admin/organizations/${orgId}`,
      );
      try {
        return normalizeAdminOrganizationDetail(res);
      } catch (e: unknown) {
        throw new Error(
          e instanceof Error
            ? e.message
            : t('admin.pages.orgDetail.invalidResponse'),
        );
      }
    },
  });

  const { data: activity } = useQuery({
    queryKey: ['admin', 'organization', orgId, 'activity-summary'],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<AdminActivitySummary> => {
      const { data: res } = await api.get<AdminActivitySummary>(
        `/admin/organizations/${orgId}/activity-summary`,
      );
      return res;
    },
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['admin', 'organization', orgId, 'notes'],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<AdminOrgNote[]> => {
      const { data: res } = await api.get<unknown>(
        `/admin/organizations/${orgId}/notes`,
      );
      return normalizeAdminOrgNotes(res);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      await api.post(`/admin/organizations/${orgId}/notes`, { note });
    },
    onSuccess: () => {
      setNoteDraft('');
      void refetchNotes();
      toast.success(t('admin.pages.orgDetail.toast.noteAdded'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/organizations/${orgId}`);
    },
    onSuccess: () => {
      setDeleteOpen(false);
      toast.success(t('admin.pages.orgDetail.toast.orgDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      navigate('/admin/organizations');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const exportMutation = useMutation({
    mutationFn: async (slug: string) => {
      const response = await api.get(`/admin/organizations/${orgId}/export`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      if (blob.type.includes('json')) {
        const text = await blob.text();
        let message = t('admin.pages.orgDetail.toast.exportFailed');
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (typeof parsed.message === 'string') {
            message = parsed.message;
          }
        } catch {
          /* yut */
        }
        throw new Error(message);
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slug || orgId}-export.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t('admin.pages.orgDetail.toast.exportDownloaded')),
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const exportAuditCsvMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(
        `/admin/organizations/${orgId}/audit-logs/export`,
        { params: { format: 'csv' }, responseType: 'blob' },
      );
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${data?.organization.slug ?? orgId}-denetim.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t('admin.pages.orgDetail.toast.auditCsvDownloaded')),
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const editInfoMutation = useMutation({
    mutationFn: async (payload: {
      name?: string;
      taxId?: string;
      taxOffice?: string;
      city?: string;
      address?: string;
      website?: string;
    }) => {
      await api.patch(`/admin/organizations/${orgId}/info`, payload);
    },
    onSuccess: () => {
      setEditInfoOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organization', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      toast.success(t('admin.orgDetail.editInfoDialog.saved'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  if (!orgId) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={t('admin.nav.organizations')}
          description={t('admin.pages.orgDetail.invalidUrl')}
          backLink={{
            to: '/admin/organizations',
            label: t('admin.pages.orgDetail.backToOrganizations'),
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-6 pt-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    const message = getApiErrorMessage(error);
    const isPartnerDetail =
      isAxiosError(error) &&
      (error.response?.status === 400 ||
        message.toLowerCase().includes('partner'));

    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={t('admin.nav.organizations')}
          description={message}
          backLink={{
            to: '/admin/organizations',
            label: t('admin.pages.orgDetail.backToOrganizations'),
          }}
        />
        <Card>
          <CardContent className="pt-6">
        <QueryErrorAlert
          error={error}
          onRetry={
            !isPartnerDetail
              ? () => {
                  void refetch();
                }
              : undefined
          }
        />
          {isPartnerDetail ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('admin.pages.orgDetail.partnerErrorHint')}{' '}
              <Link
                to="/admin/partners"
                className="font-medium text-sky-700 underline underline-offset-2"
              >
                {t('admin.pages.orgDetail.partnerErrorLink')}
              </Link>{' '}
              {t('admin.pages.orgDetail.partnerErrorSuffix')}
            </p>
          ) : null}
          {isPartnerDetail ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
              <Link to="/admin/partners">{t('admin.pages.orgDetail.goToPartners')}</Link>
            </Button>
          ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { organization: o, subscription: sub } = data;
  const activePartners = asArray<AdminOrgDetailPartnerLink>(data.activePartners);
  const isPartnerOrg = o.type === 'PARTNER';
  const deleteBlockedReason = getOrgDeleteBlockedReason(
    { slug: o.slug, type: o.type },
    t,
  );
  const resolvedAccountingMode = resolveAccountingMode(
    data.accountingMode,
    data.activeErpConnectionCount,
  );
  const accountingModeResolved = data.accountingMode == null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={o.name}
        description={[
          o.slug,
          o.taxNumber
            ? t('admin.pages.orgDetail.taxNumber', { value: o.taxNumber })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        backLink={{
          to: '/admin/organizations',
          label: t('admin.pages.orgDetail.backToOrganizations'),
        }}
        breadcrumbParent={{
          label: t('admin.nav.organizations'),
          to: '/admin/organizations',
        }}
        meta={
          <>
            <div className="flex flex-wrap items-center gap-2">
              {o.suspended ? (
                <Badge variant="destructive" className="text-xs font-normal">
                  {adminAccountStatusLabel(true, t)}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-xs font-normal text-emerald-900"
                >
                  {adminAccountStatusLabel(false, t)}
                </Badge>
              )}
              {sub ? (
                <>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {planTierLabel(sub.plan)}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal">
                    {subscriptionStatusLabel(sub.status)}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline" className="text-xs font-normal">
                  {adminNoSubscriptionLabel(t)}
                </Badge>
              )}
              <OrgProductLineBadges orgProducts={data.orgProducts} />
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-normal',
                  adminAccountingModeBadgeClass(resolvedAccountingMode),
                )}
                title={
                  accountingModeResolved
                    ? t('admin.pages.orgDetail.accountingModeResolvedTitle')
                    : undefined
                }
              >
                {adminAccountingModeLabel(resolvedAccountingMode, t)}
              </Badge>
            </div>
            {activePartners.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {activePartners.map((p) => (
                  <li key={p.relationshipId}>
                    <span className="text-muted-foreground">
                      {t('admin.pages.orgDetail.partnerPrefix')}{' '}
                    </span>
                    <Link
                      to={`/admin/partners${adminPartnerPageHash(p.partnerOrgId)}`}
                      className="font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                    {' · '}
                    <Link
                      to={adminOrganizationsByPartnerUrl(p.partnerOrgId)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {t('admin.common.partnerClients')}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        }
        actions={
          sub ? (
            <div className="text-xs text-muted-foreground lg:text-right">
              <p>
                {t('admin.pages.orgDetail.period')}{' '}
                {formatSafeDate(sub.currentPeriodStart, 'd MMM yyyy', emDash)} —{' '}
                {formatSafeDate(sub.currentPeriodEnd, 'd MMM yyyy', emDash)}
              </p>
              {sub.trialEndsAt ? (
                <p className="mt-1">
                  {t('admin.pages.orgDetail.trialEnds')}{' '}
                  {formatSafeDate(sub.trialEndsAt, 'd MMM yyyy', emDash)}
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.pages.orgDetail.activitySummary')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('admin.pages.orgDetail.last30Days')}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activity?.syncCount ?? emDash}
              </p>
              <p className="text-xs text-muted-foreground">{t('admin.pages.orgDetail.sync')}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activity?.orderCount ?? emDash}
              </p>
              <p className="text-xs text-muted-foreground">{t('admin.pages.orgDetail.orders')}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-destructive">
                {activity?.errorCount ?? emDash}
              </p>
              <p className="text-xs text-muted-foreground">{t('admin.pages.orgDetail.errors')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.pages.orgDetail.notes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder={t('admin.pages.orgDetail.notePlaceholder')}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
              />
              <Button
                type="button"
                size="sm"
                disabled={
                  !noteDraft.trim() || addNoteMutation.isPending
                }
                onClick={() => addNoteMutation.mutate(noteDraft.trim())}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                {t('admin.pages.orgDetail.addNote')}
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.pages.orgDetail.noNotesYet')}</p>
            ) : (
              <ul className="max-h-48 space-y-3 overflow-y-auto">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatSafeDate(n.createdAt, 'd MMM yyyy HH:mm', emDash)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-900">
            <AlertTriangle className="size-5" aria-hidden />
            {t('admin.pages.orgDetail.dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate(o.slug)}
          >
            {exportMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 size-4" aria-hidden />
            )}
            {t('admin.pages.orgDetail.exportZip')}
          </Button>
          {deleteBlockedReason ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">{deleteBlockedReason}</p>
              {isPartnerOrg ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/admin/partners">{t('admin.pages.orgDetail.goToPartnerManagement')}</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" aria-hidden />
              {t('admin.pages.orgDetail.deleteOrg')}
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.pages.orgDetail.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.pages.orgDetail.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrgMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteOrgMutation.mutate();
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

      <Card>
        <CardContent className="space-y-4 pt-6">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="settings">{t('admin.pages.orgDetail.tabs.settings')}</TabsTrigger>
          <TabsTrigger value="general">{t('admin.pages.orgDetail.tabs.general')}</TabsTrigger>
          <TabsTrigger value="users">{t('admin.pages.orgDetail.tabs.users')}</TabsTrigger>
          <TabsTrigger value="connections">{t('admin.pages.orgDetail.tabs.connections')}</TabsTrigger>
          <TabsTrigger value="orders">{t('admin.pages.orgDetail.tabs.orders')}</TabsTrigger>
          <TabsTrigger value="audit">{t('admin.pages.orgDetail.tabs.audit')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('admin.pages.orgDetail.tabs.invoices')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <AdminOrgSettingsPanel orgId={orgId} data={data} />
        </TabsContent>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('admin.pages.orgDetail.settingsHintBefore')}{' '}
              <Link
                to={adminOrgDetailUrl(orgId, 'settings')}
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('admin.pages.orgDetail.settingsHintLink')}
              </Link>{' '}
              {t('admin.pages.orgDetail.settingsHintAfter')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditInfoDraft({
                  name: o.name,
                  taxId: o.taxNumber ?? '',
                  taxOffice: o.taxOffice ?? '',
                  city: o.city ?? '',
                  address: o.address ?? '',
                  website: o.website ?? '',
                });
                setEditInfoOpen(true);
              }}
            >
              {t('admin.orgDetail.editInfo')}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.pages.orgDetail.contactAddress')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.taxOffice')}</p>
                <p className="font-medium">{o.taxOffice ?? emDash}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.city')}</p>
                <p className="font-medium">{o.city ?? emDash}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.address')}</p>
                <p className="font-medium">{o.address ?? emDash}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.website')}</p>
                <p className="font-medium">{o.website ?? emDash}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.registeredAt')}</p>
                <p className="font-medium">
                  {formatSafeDate(o.createdAt, 'd MMMM yyyy', emDash)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('admin.pages.orgDetail.orgType')}</p>
                <p className="font-medium">{orgTypeLabel(o.type)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.pages.orgDetail.usersTable.name')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.usersTable.email')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.usersTable.role')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.usersTable.lastLogin')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {t('admin.pages.orgDetail.usersTable.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{userRoleLabel(u.role)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatSafeDate(u.lastLoginAt, 'd MMM yyyy HH:mm', emDash)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <AdminOrgConnectionsPanel orgId={orgId} data={data} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.pages.orgDetail.ordersTable.platform')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.ordersTable.order')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.ordersTable.customer')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.ordersTable.status')}</TableHead>
                    <TableHead className="text-right">{t('admin.pages.orgDetail.ordersTable.amount')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.ordersTable.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {t('admin.pages.orgDetail.ordersTable.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentOrders.map((ord) => {
                      const meta = getMarketplaceDisplay(ord.platform);
                      return (
                        <TableRow key={ord.id}>
                          <TableCell>{meta.label}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {ord.platformOrderId}
                          </TableCell>
                          <TableCell>{ord.customerName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                isKnownOrderStatus(ord.status)
                                  ? orderStatusTone(ord.status)
                                  : undefined
                              }
                            >
                              {orderStatusLabel(ord.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(() => {
                              const amount = Number(ord.totalAmount);
                              return Number.isFinite(amount)
                                ? tryFormatter.format(amount)
                                : emDash;
                            })()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatSafeDate(ord.createdAt, 'd MMM HH:mm', emDash)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportAuditCsvMutation.isPending}
              onClick={() => exportAuditCsvMutation.mutate()}
            >
              {exportAuditCsvMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 size-4" aria-hidden />
              )}
              {t('admin.pages.orgDetail.auditTable.exportCsv')}
            </Button>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.pages.orgDetail.auditTable.date')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.auditTable.action')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.auditTable.resource')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAuditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {t('admin.pages.orgDetail.auditTable.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentAuditLogs.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatSafeDate(a.createdAt, 'd MMM yyyy HH:mm', emDash)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatAuditLogAction(a.action)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAuditLogResourceDisplay(
                            a.resourceType,
                            a.resourceId,
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.pages.orgDetail.invoicesTable.date')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.invoicesTable.plan')}</TableHead>
                    <TableHead>{t('admin.pages.orgDetail.invoicesTable.status')}</TableHead>
                    <TableHead className="text-right">{t('admin.pages.orgDetail.invoicesTable.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {data.billingExempt
                          ? t('admin.pages.orgDetail.invoicesTable.billingExempt')
                          : t('admin.pages.orgDetail.invoicesTable.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">
                          {formatSafeDate(p.createdAt, 'd MMM yyyy HH:mm', emDash)}
                        </TableCell>
                        <TableCell>{planTierLabel(p.plan)}</TableCell>
                        <TableCell>{paymentStatusLabel(p.status)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number.isFinite(p.amount)
                            ? tryFormatter.format(p.amount / 100)
                            : emDash}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.orgDetail.editInfoDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-edit-org-name">
                {t('admin.orgDetail.editInfoDialog.name')}
              </Label>
              <Input
                id="admin-edit-org-name"
                value={editInfoDraft.name}
                maxLength={200}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-org-tax-id">
                {t('admin.orgDetail.editInfoDialog.taxId')}
              </Label>
              <Input
                id="admin-edit-org-tax-id"
                value={editInfoDraft.taxId}
                maxLength={100}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, taxId: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-org-tax-office">
                {t('admin.orgDetail.editInfoDialog.taxOffice')}
              </Label>
              <Input
                id="admin-edit-org-tax-office"
                value={editInfoDraft.taxOffice}
                maxLength={100}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, taxOffice: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-org-city">
                {t('admin.orgDetail.editInfoDialog.city')}
              </Label>
              <Input
                id="admin-edit-org-city"
                value={editInfoDraft.city}
                maxLength={100}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-edit-org-address">
                {t('admin.orgDetail.editInfoDialog.address')}
              </Label>
              <Input
                id="admin-edit-org-address"
                value={editInfoDraft.address}
                maxLength={500}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, address: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-edit-org-website">
                {t('admin.orgDetail.editInfoDialog.website')}
              </Label>
              <Input
                id="admin-edit-org-website"
                value={editInfoDraft.website}
                maxLength={200}
                onChange={(e) =>
                  setEditInfoDraft((prev) => ({ ...prev, website: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditInfoOpen(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={editInfoMutation.isPending || editInfoDraft.name.trim().length === 0}
              onClick={() => {
                editInfoMutation.mutate({
                  name: editInfoDraft.name.trim(),
                  taxId: editInfoDraft.taxId.trim() || undefined,
                  taxOffice: editInfoDraft.taxOffice.trim() || undefined,
                  city: editInfoDraft.city.trim() || undefined,
                  address: editInfoDraft.address.trim() || undefined,
                  website: editInfoDraft.website.trim() || undefined,
                });
              }}
            >
              {editInfoMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
