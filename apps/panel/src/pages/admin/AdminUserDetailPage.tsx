import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { isAxiosError } from 'axios';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DataTablePagination } from '@/components/DataTablePagination';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useAdminUserMutations } from '@/hooks/useAdminUserMutations';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { normalizeAdminUsersListResponse } from '@/lib/admin-api-normalize';
import {
  adminAccountStatusLabel,
  adminUserRoleLabel,
} from '@/lib/admin-i18n-labels';
import { adminOrgDetailUrl } from '@/lib/admin-org-detail-nav';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type {
  AdminUserAuditLogResponse,
  AdminUserDetail,
  AdminUsersListResponse,
} from '@/types/admin';

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'] as const;

const AUDIT_FILTER_DEFAULTS = { page: 1, limit: 20 };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatSafeDate(
  iso: string | null | undefined,
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
    return format(d, 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return empty;
  }
}

function normalizeAdminUserDetail(raw: unknown): AdminUserDetail {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Invalid user detail response');
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!id) {
    throw new Error('Invalid user detail response');
  }
  let organization: AdminUserDetail['organization'] = null;
  if (r.organization !== null && typeof r.organization === 'object') {
    const o = r.organization as Record<string, unknown>;
    if (typeof o.id === 'string') {
      organization = {
        id: o.id,
        name: typeof o.name === 'string' ? o.name : '—',
        slug: typeof o.slug === 'string' ? o.slug : '—',
        suspended: o.suspended === true,
      };
    }
  }
  return {
    id,
    email: typeof r.email === 'string' ? r.email : '—',
    name: typeof r.name === 'string' && r.name.trim().length > 0 ? r.name : '—',
    phone: typeof r.phone === 'string' ? r.phone : null,
    role: typeof r.role === 'string' ? r.role : '—',
    suspended: r.suspended === true,
    lastLoginAt: typeof r.lastLoginAt === 'string' ? r.lastLoginAt : null,
    lockedUntil: typeof r.lockedUntil === 'string' ? r.lockedUntil : null,
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
    organization,
  };
}

function normalizeAdminUserAuditLogResponse(
  raw: unknown,
): AdminUserAuditLogResponse {
  if (raw === null || typeof raw !== 'object') {
    return { logs: [], total: 0, page: 1, limit: 20 };
  }
  const r = raw as Record<string, unknown>;
  const logs = Array.isArray(r.logs)
    ? r.logs
        .map((entry) => {
          if (entry === null || typeof entry !== 'object') {
            return null;
          }
          const e = entry as Record<string, unknown>;
          const logId = typeof e.id === 'string' ? e.id : '';
          if (!logId) {
            return null;
          }
          return {
            id: logId,
            action: typeof e.action === 'string' ? e.action : '—',
            resourceType: typeof e.resourceType === 'string' ? e.resourceType : '—',
            resourceId: typeof e.resourceId === 'string' ? e.resourceId : null,
            createdAt:
              typeof e.createdAt === 'string'
                ? e.createdAt
                : new Date(0).toISOString(),
          };
        })
        .filter((x): x is AdminUserAuditLogResponse['logs'][number] => x !== null)
    : [];
  return {
    logs,
    total: typeof r.total === 'number' ? r.total : logs.length,
    page: typeof r.page === 'number' ? r.page : 1,
    limit: typeof r.limit === 'number' ? r.limit : 20,
  };
}

export function AdminUserDetailPage(): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const { id: userId } = useParams<{ id: string }>();

  const [urlFilters, setUrlFilters] = useUrlFilters(AUDIT_FILTER_DEFAULTS);
  const { page, limit } = urlFilters;

  const [roleOpen, setRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>('ADMIN');
  const [suspendOpen, setSuspendOpen] = useState(false);

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'user', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AdminUserDetail> => {
      const { data: res } = await api.get<unknown>(`/admin/users/${userId}`);
      return normalizeAdminUserDetail(res);
    },
  });

  const orgId = user?.organization?.id;

  const { data: orgUserTotal } = useQuery({
    queryKey: ['admin', 'users', 'org-count', orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<number> => {
      const { data: res } = await api.get<AdminUsersListResponse>('/admin/users', {
        params: { orgId, page: 1, limit: 1 },
      });
      return normalizeAdminUsersListResponse(res).total;
    },
  });

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
    error: auditQueryError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['admin', 'user', userId, 'audit-log', page, limit],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AdminUserAuditLogResponse> => {
      const { data: res } = await api.get<unknown>(
        `/admin/users/${userId}/audit-log`,
        { params: { page, limit } },
      );
      return normalizeAdminUserAuditLogResponse(res);
    },
  });

  const {
    suspendMutation,
    unsuspendMutation,
    roleMutation,
    sessionsMutation,
    resetPasswordMutation,
  } = useAdminUserMutations({
    detailUserId: userId,
    onSuspendSuccess: () => setSuspendOpen(false),
    onRoleSuccess: () => setRoleOpen(false),
  });

  const auditTotal = auditData?.total ?? 0;
  const auditLimit = auditData?.limit ?? limit;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));
  const otherOrgUsers =
    orgUserTotal !== undefined && orgUserTotal > 0
      ? Math.max(0, orgUserTotal - 1)
      : null;

  const notFound =
    isError && isAxiosError(error) && error.response?.status === 404;

  if (!userId) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={t('admin.nav.users')}
          description={t('admin.pages.orgDetail.invalidUrl')}
          backLink={{
            to: '/admin/users',
            label: t('admin.pages.userDetail.backToUsers'),
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card aria-busy="true">
        <CardContent className="space-y-6 pt-6">
          <Skeleton className="h-24 w-full max-w-2xl" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !user) {
    const errorMessage = notFound
      ? t('admin.common.listEmpty.users')
      : getApiErrorMessage(error);
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={t('admin.nav.users')}
          description={errorMessage}
          backLink={{
            to: '/admin/users',
            label: t('admin.pages.userDetail.backToUsers'),
          }}
        />
        {!notFound ? (
          <Card>
            <CardContent className="pt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {t('admin.common.retry')}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          {t('admin.users.table.actions')}
          <MoreHorizontal className="ml-2 size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={user.role === 'SUPER_ADMIN'}
          onClick={() => {
            setNewRole(user.role === 'SUPER_ADMIN' ? 'ADMIN' : user.role);
            setRoleOpen(true);
          }}
        >
          {t('admin.pages.userDetail.actions.changeRole')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void sessionsMutation.mutate(user.id)}>
          {t('admin.pages.userDetail.actions.killSessions')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void resetPasswordMutation.mutate(user.id)}>
          {t('admin.pages.userDetail.actions.resetPassword')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.suspended ? (
          <DropdownMenuItem onClick={() => void unsuspendMutation.mutate(user.id)}>
            {t('admin.pages.userDetail.actions.unsuspend')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={user.role === 'SUPER_ADMIN'}
            onClick={() => setSuspendOpen(true)}
          >
            {t('admin.pages.userDetail.actions.suspend')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.name}
        description={user.email}
        backLink={{
          to: '/admin/users',
          label: t('admin.pages.userDetail.backToUsers'),
        }}
        breadcrumbParent={{
          label: t('admin.nav.users'),
          to: '/admin/users',
        }}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{adminUserRoleLabel(user.role, t)}</Badge>
            {user.suspended ? (
              <Badge variant="destructive">
                {adminAccountStatusLabel(true, t)}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                {adminAccountStatusLabel(false, t)}
              </Badge>
            )}
          </div>
        }
        actions={actionsMenu}
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            {t('admin.pages.userDetail.tabs.general')}
          </TabsTrigger>
          <TabsTrigger value="activity">
            {t('admin.pages.userDetail.tabs.activity')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {t('admin.pages.userDetail.tabs.general')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="bg-sky-100 text-lg text-sky-900">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {adminUserRoleLabel(user.role, t)}
                    </Badge>
                    {user.suspended ? (
                      <Badge variant="destructive">
                        {adminAccountStatusLabel(true, t)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                        {adminAccountStatusLabel(false, t)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t('admin.pages.userDetail.orgLabel')}
                  </dt>
                  <dd className="mt-1 text-sm">
                    {user.organization ? (
                      <>
                        <Link
                          to={adminOrgDetailUrl(user.organization.id)}
                          className="font-medium text-sky-700 underline-offset-2 hover:underline"
                        >
                          {user.organization.name}
                        </Link>
                        <p className="text-muted-foreground">{user.organization.slug}</p>
                        {user.organization.suspended ? (
                          <Badge variant="destructive" className="mt-1">
                            {t('admin.pages.subscriptions.orgSuspended')}
                          </Badge>
                        ) : null}
                        {otherOrgUsers !== null ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t('admin.pages.userDetail.orgOtherUsers', {
                              count: otherOrgUsers,
                            })}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{emDash}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t('admin.pages.userDetail.registeredAt')}
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatSafeDate(user.createdAt, emDash)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t('admin.pages.userDetail.lastLogin')}
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatSafeDate(user.lastLoginAt, emDash)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {auditLoading ? <TableSkeleton rows={6} cols={3} /> : null}

          {auditError ? (
            <QueryErrorAlert
              error={auditQueryError}
              onRetry={() => {
                void refetchAudit();
              }}
            />
          ) : null}

          {!auditLoading && !auditError && auditData && auditData.logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.pages.userDetail.emptyActivity')}
            </p>
          ) : null}

          {!auditLoading && !auditError && auditData && auditData.logs.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.pages.orgDetail.auditTable.action')}</TableHead>
                      <TableHead>{t('admin.pages.orgDetail.auditTable.resource')}</TableHead>
                      <TableHead>{t('admin.pages.orgDetail.auditTable.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.logs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {formatAuditLogAction(row.action)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAuditLogResourceDisplay(
                            row.resourceType,
                            row.resourceId,
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatSafeDate(row.createdAt, emDash)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination
                page={page}
                totalPages={auditTotalPages}
                total={auditTotal}
                limit={auditLimit}
                onPageChange={(p) => {
                  setUrlFilters({ page: p });
                }}
                onLimitChange={(nextLimit) => {
                  setUrlFilters({ limit: nextLimit, page: 1 });
                }}
              />
            </>
          ) : null}
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.users.dialogs.suspendTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.users.dialogs.suspendDescription', {
                name: user.name,
                email: user.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={suspendMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                suspendMutation.mutate(user.id);
              }}
            >
              {suspendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                t('admin.users.dialogs.suspendConfirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.dialogs.changeRoleTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.dialogs.changeRoleDescription', {
                name: user.name,
                role: adminUserRoleLabel(user.role, t),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('admin.users.dialogs.newRole')}</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {adminUserRoleLabel(role, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleOpen(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={roleMutation.isPending || newRole === user.role}
              onClick={() => {
                roleMutation.mutate({ id: user.id, role: newRole });
              }}
            >
              {roleMutation.isPending ? (
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
