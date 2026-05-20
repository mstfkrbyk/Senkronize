import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminOrgListResponse, AdminUsersListResponse } from '@/types/admin';

const PAGE_SIZE = 20;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  VIEWER: 'Görüntüleyici',
};

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Sahip' },
  { value: 'ADMIN', label: 'Yönetici' },
  { value: 'MANAGER', label: 'Müdür' },
  { value: 'VIEWER', label: 'Görüntüleyici' },
] as const;

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
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{
    id: string;
    name: string;
    current: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<string>('ADMIN');

  const { data: orgOptions } = useQuery({
    queryKey: ['admin', 'organizations', 'options'],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        { params: { page: 1, limit: 100 } },
      );
      return res;
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search, orgFilter, roleFilter],
    queryFn: async (): Promise<AdminUsersListResponse> => {
      const { data: res } = await api.get<AdminUsersListResponse>('/admin/users', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          orgId: orgFilter === 'all' ? undefined : orgFilter,
          role: roleFilter === 'all' ? undefined : roleFilter,
        },
      });
      return res;
    },
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/users/${userId}/suspend`);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Kullanıcı askıya alındı.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/users/${userId}/unsuspend`);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Askı kaldırıldı.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const roleMutation = useMutation({
    mutationFn: async (payload: { id: string; role: string }) => {
      await api.patch(`/admin/users/${payload.id}/role`, { role: payload.role });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Rol güncellendi.');
      setRoleOpen(false);
      setRoleTarget(null);
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const sessionsMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}/sessions`);
    },
    onSuccess: () => {
      toast.success('Oturumlar sonlandırıldı.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/admin/users/${userId}/reset-password`);
    },
    onSuccess: () => {
      toast.success('Şifre sıfırlama e-postası gönderildi.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Kullanıcılar</h2>
          <p className="text-sm text-muted-foreground">
            İsim veya e-posta ile arayın; organizasyon ve rol filtreleyin.
          </p>
        </div>
        <form
          className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          <Input
            placeholder="İsim veya e-posta…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="submit">Ara</Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Organizasyon</Label>
          <Select
            value={orgFilter}
            onValueChange={(v) => {
              setPage(1);
              setOrgFilter(v);
            }}
          >
            <SelectTrigger className="w-[220px] bg-background">
              <SelectValue placeholder="Organizasyon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {(orgOptions?.orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rol</Label>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setPage(1);
              setRoleFilter(v);
            }}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void refetch()}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Organizasyon</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Son giriş</TableHead>
                  <TableHead className="w-[1%] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Kullanıcı bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-sky-100 text-sky-900 text-xs">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            {u.suspended ? (
                              <Badge variant="destructive" className="mt-1">
                                Askıda
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.organization ? (
                          <>
                            <p className="font-medium">{u.organization.name}</p>
                            <p className="text-muted-foreground">{u.organization.slug}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.lastLoginAt
                          ? format(new Date(u.lastLoginAt), 'd MMM yyyy HH:mm', {
                              locale: tr,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" aria-hidden />
                              <span className="sr-only">Menü</span>
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
                              Rol değiştir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void sessionsMutation.mutate(u.id)
                              }
                            >
                              Oturumları sonlandır
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void resetPasswordMutation.mutate(u.id)
                              }
                            >
                              Şifreyi sıfırla
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.suspended ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  void unsuspendMutation.mutate(u.id)
                                }
                              >
                                Askıyı kaldır
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={u.role === 'SUPER_ADMIN'}
                                onClick={() => void suspendMutation.mutate(u.id)}
                              >
                                Askıya al
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Toplam {total} kullanıcı · Sayfa {data.page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
                type="button"
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
      ) : null}

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol değiştir</DialogTitle>
          </DialogHeader>
          {roleTarget ? (
            <p className="text-sm text-muted-foreground">
              {roleTarget.name} — mevcut: {ROLE_LABEL[roleTarget.current] ?? roleTarget.current}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label>Yeni rol</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={!roleTarget || roleMutation.isPending}
              onClick={() => {
                if (!roleTarget) return;
                void roleMutation.mutateAsync({
                  id: roleTarget.id,
                  role: newRole,
                });
              }}
            >
              {roleMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
