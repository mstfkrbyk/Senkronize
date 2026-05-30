import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Loader2, MoreHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  normalizeAdminOrgListResponse,
  normalizeAdminUsersListResponse,
} from '@/lib/admin-api-normalize';
import { adminAccountStatusLabel, adminUserRoleLabel } from '@/lib/admin-i18n-labels';
import { useAdminUserMutations } from '@/hooks/useAdminUserMutations';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  readAdminOrgProductFilterParam,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';
import { downloadAdminUsersCsvFromServer } from '@/pages/admin/admin-users-csv';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { ADMIN_USER_FILTER_DEFAULTS } from '@/pages/admin/admin-users-filters.config';
import { AdminOrgProductFilterSelect } from '@/pages/admin/AdminOrgProductFilterSelect';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type { AdminOrgListResponse, AdminUsersListResponse } from '@/types/admin';

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'] as const;

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

export function AdminUsersPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const productFilter = readAdminOrgProductFilterParam(searchParams.get('product'));

  const [urlFilters, setUrlFilters] = useUrlFilters(ADMIN_USER_FILTER_DEFAULTS);
  const { page, limit, search, orgId: orgFilter, role: roleFilter } = urlFilters;
  const [searchDraft, setSearchDraft] = useState(search);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{
    id: string;
    name: string;
    current: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<string>('ADMIN');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameTarget, setEditNameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editNameDraft, setEditNameDraft] = useState('');

  const { data: orgOptions } = useQuery({
    queryKey: ['admin', 'organizations', 'options'],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        { params: { page: 1, limit: 100 } },
      );
      return normalizeAdminOrgListResponse(res);
    },
  });

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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', page, limit, search, orgFilter, roleFilter, productFilter],
    queryFn: async (): Promise<AdminUsersListResponse> => {
      const { data: res } = await api.get<AdminUsersListResponse>('/admin/users', {
        params: {
          page,
          limit,
          search: search || undefined,
          orgId: orgFilter === 'all' ? undefined : orgFilter,
          role: roleFilter === 'all' ? undefined : roleFilter,
          product: productFilter === 'all' ? undefined : productFilter,
        },
      });
      return normalizeAdminUsersListResponse(res);
    },
  });

  const {
    suspendMutation,
    unsuspendMutation,
    roleMutation,
    sessionsMutation,
    resetPasswordMutation,
  } = useAdminUserMutations({
    onSuspendSuccess: () => {
      setSuspendOpen(false);
      setSuspendTarget(null);
    },
    onRoleSuccess: () => {
      setRoleOpen(false);
      setRoleTarget(null);
    },
  });

  const invalidateUsers = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const editNameMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      await api.patch(`/admin/users/${payload.id}`, { name: payload.name });
    },
    onSuccess: () => {
      invalidateUsers();
      setEditNameOpen(false);
      setEditNameTarget(null);
      toast.success(t('admin.users.editNameDialog.saved'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const total = data?.total ?? 0;
  const effectiveLimit = data?.limit ?? limit;
  const totalPages = Math.max(1, Math.ceil(total / effectiveLimit));
  const hasActiveFilters =
    search.trim().length > 0 ||
    orgFilter !== 'all' ||
    roleFilter !== 'all' ||
    productFilter !== 'all';

  async function handleExportCsv(): Promise<void> {
    setExportingCsv(true);
    try {
      await downloadAdminUsersCsvFromServer(
        {
          search: search || undefined,
          orgId: orgFilter === 'all' ? undefined : orgFilter,
          role: roleFilter === 'all' ? undefined : roleFilter,
          product: productFilter,
        },
        undefined,
        t,
      );
      toast.success(t('admin.users.toast.csvDownloaded'));
    } catch (e: unknown) {
      if (total === 0) {
        toast.error(t('admin.users.toast.exportEmpty'));
      } else {
        toast.error(getApiErrorMessage(e));
      }
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.users.title')}
        description={t('admin.pages.users.description')}
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
              {t('admin.pages.users.exportCsv')}
            </Button>
            <form
              className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                setUrlFilters({ page: 1, search: searchDraft.trim() });
              }}
            >
              <Input
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
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
          <Label className="text-xs text-muted-foreground">{t('admin.common.organization')}</Label>
          <Select
            value={orgFilter}
            onValueChange={(v) => {
              setUrlFilters({ page: 1, orgId: v });
            }}
          >
            <SelectTrigger className="w-[220px] bg-background">
              <SelectValue placeholder={t('admin.common.organization')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.common.all')}</SelectItem>
              {(orgOptions?.orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('admin.common.role')}</Label>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setUrlFilters({ page: 1, role: v });
            }}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder={t('admin.common.role')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.common.all')}</SelectItem>
              {(['SUPER_ADMIN', ...ROLE_OPTIONS] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {adminUserRoleLabel(value, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <TableSkeleton rows={8} cols={5} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && data && data.users.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={hasActiveFilters}
          emptyTitle={t('admin.common.listEmpty.users')}
        />
      ) : null}

      {!isLoading && !isError && data && data.users.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.users.table.user')}</TableHead>
                  <TableHead>{t('admin.users.table.organization')}</TableHead>
                  <TableHead>{t('admin.users.table.role')}</TableHead>
                  <TableHead>{t('admin.users.table.lastLogin')}</TableHead>
                  <TableHead className="w-[1%] text-right">{t('admin.users.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-sky-100 text-sky-900 text-xs">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              to={`/admin/users/${u.id}`}
                              className="font-medium text-sky-700 underline-offset-2 hover:underline"
                            >
                              {u.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            {u.suspended ? (
                              <Badge variant="destructive" className="mt-1">
                                {adminAccountStatusLabel(true, t)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.organization ? (
                          <>
                            <Link
                              to={`/admin/organizations/${u.organization.id}`}
                              className="font-medium text-sky-700 underline-offset-2 hover:underline"
                            >
                              {u.organization.name}
                            </Link>
                            <p className="text-muted-foreground">{u.organization.slug}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{t('admin.common.emDash')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {adminUserRoleLabel(u.role, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.lastLoginAt
                          ? format(new Date(u.lastLoginAt), 'd MMM yyyy HH:mm', {
                              locale: tr,
                            })
                          : t('admin.common.emDash')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" aria-hidden />
                              <span className="sr-only">{t('admin.common.menuAria')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={u.role === 'SUPER_ADMIN'}
                              onClick={() => {
                                setRoleTarget({
                                  id: u.id,
                                  name: u.name,
                                  current: u.role,
                                });
                                setNewRole(
                                  u.role === 'SUPER_ADMIN' ? 'ADMIN' : u.role,
                                );
                                setRoleOpen(true);
                              }}
                            >
                              {t('admin.users.actions.changeRole')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditNameTarget({ id: u.id, name: u.name });
                                setEditNameDraft(u.name);
                                setEditNameOpen(true);
                              }}
                            >
                              {t('admin.users.actions.editName')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void sessionsMutation.mutate(u.id)
                              }
                            >
                              {t('admin.users.actions.endSessions')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void resetPasswordMutation.mutate(u.id)
                              }
                            >
                              {t('admin.users.actions.resetPassword')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.suspended ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  void unsuspendMutation.mutate(u.id)
                                }
                              >
                                {t('admin.users.actions.unsuspend')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={u.role === 'SUPER_ADMIN'}
                                onClick={() => {
                                  setSuspendTarget({
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                  });
                                  setSuspendOpen(true);
                                }}
                              >
                                {t('admin.users.actions.suspend')}
                              </DropdownMenuItem>
                            )}
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
        open={suspendOpen}
        onOpenChange={(open) => {
          setSuspendOpen(open);
          if (!open) {
            setSuspendTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.users.dialogs.suspendTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget
                ? t('admin.users.dialogs.suspendDescription', {
                    name: suspendTarget.name,
                    email: suspendTarget.email,
                  })
                : t('admin.users.dialogs.suspendDescriptionGeneric')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!suspendTarget || suspendMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!suspendTarget) {
                  return;
                }
                suspendMutation.mutate(suspendTarget.id);
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

      <Dialog
        open={editNameOpen}
        onOpenChange={(open) => {
          setEditNameOpen(open);
          if (!open) {
            setEditNameTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.editNameDialog.title')}</DialogTitle>
            {editNameTarget ? (
              <DialogDescription>{editNameTarget.name}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-edit-user-name">
              {t('admin.users.editNameDialog.label')}
            </Label>
            <Input
              id="admin-edit-user-name"
              value={editNameDraft}
              maxLength={200}
              onChange={(e) => setEditNameDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditNameOpen(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                !editNameTarget ||
                editNameMutation.isPending ||
                editNameDraft.trim().length === 0 ||
                editNameDraft.trim() === editNameTarget?.name
              }
              onClick={() => {
                if (!editNameTarget) {
                  return;
                }
                editNameMutation.mutate({
                  id: editNameTarget.id,
                  name: editNameDraft.trim(),
                });
              }}
            >
              {editNameMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleOpen}
        onOpenChange={(open) => {
          setRoleOpen(open);
          if (!open) {
            setRoleTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.dialogs.changeRoleTitle')}</DialogTitle>
            {roleTarget ? (
              <DialogDescription>
                {t('admin.users.dialogs.changeRoleDescription', {
                  name: roleTarget.name,
                  role: adminUserRoleLabel(roleTarget.current, t),
                })}
              </DialogDescription>
            ) : null}
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
              disabled={
                !roleTarget ||
                roleMutation.isPending ||
                newRole === roleTarget?.current
              }
              onClick={() => {
                if (!roleTarget) {
                  return;
                }
                roleMutation.mutate({
                  id: roleTarget.id,
                  role: newRole,
                });
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
