import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Loader2,
  MoreHorizontal,
  Shield,
  UserCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { AdminOrgListResponse } from '@/types/admin';
import type { OrgPlanTier } from '@/types/auth';

const PLAN_LABEL: Record<string, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const SUB_LABEL: Record<string, string> = {
  TRIAL: 'Deneme',
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi doldu',
};

const PAGE_SIZE = 20;

const PLAN_OPTIONS: { value: OrgPlanTier; label: string }[] = [
  { value: 'BASLANGIC', label: 'Başlangıç' },
  { value: 'GELISIM', label: 'Gelişim' },
  { value: 'PRO', label: 'Pro' },
  { value: 'KURUMSAL', label: 'Kurumsal' },
];

export function AdminOrgsPage(): ReactElement {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'organizations', page, search, planFilter, statusFilter],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
            plan: planFilter === 'all' ? undefined : planFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
          },
        },
      );
      return res;
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (payload: { id: string; reason: string }) => {
      await api.post(`/admin/organizations/${payload.id}/suspend`, {
        reason: payload.reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Organizasyon askıya alındı.');
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
      toast.success('Askı kaldırıldı.');
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
      toast.success('Paket güncellendi.');
      setPlanOpen(false);
      setPlanReason('');
      setPlanTarget(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: res } = await api.post<{ token: string }>(
        `/admin/organizations/${id}/impersonate`,
      );
      return res.token;
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  async function handleImpersonate(id: string, name: string): Promise<void> {
    try {
      const token = await impersonateMutation.mutateAsync(id);
      startImpersonation({ id, name }, token);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Müşteri paneline yönlendiriliyorsunuz.');
      navigate('/dashboard');
    } catch {
      /* toast in mutation */
    }
  }

  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Organizasyonlar</h2>
          <p className="text-sm text-muted-foreground">
            Firma adı, vergi numarası veya e-posta ile arayın; paket ve durum filtreleyin.
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
            placeholder="Firma, vergi no veya e-posta…"
            value={searchDraft}
            onChange={(e) => {
              setSearchDraft(e.target.value);
            }}
            className="sm:flex-1"
          />
          <Button type="submit">Ara</Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Paket</Label>
          <Select
            value={planFilter}
            onValueChange={(v) => {
              setPage(1);
              setPlanFilter(v);
            }}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Paket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {PLAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Durum</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setPage(1);
              setStatusFilter(v);
            }}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="AKTIF">Aktif (deneme dışı)</SelectItem>
              <SelectItem value="DENEME">Deneme</SelectItem>
              <SelectItem value="ASKIDA">Askıda</SelectItem>
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
            onClick={() => {
              void refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizasyon</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Sipariş</TableHead>
                  <TableHead>Kayıt</TableHead>
                  <TableHead>Son aktivite</TableHead>
                  <TableHead className="w-[1%] text-right">Menü</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Kayıt bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="font-medium">{org.name}</div>
                        {org.taxNumber ? (
                          <div className="text-xs text-muted-foreground">
                            VKN: {org.taxNumber}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {org.subscription ? (
                          <Badge variant="secondary">
                            {PLAN_LABEL[org.subscription.plan] ?? org.subscription.plan}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {org.suspended ? (
                            <Badge variant="destructive">Askıda</Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                              Çalışıyor
                            </Badge>
                          )}
                          {org.subscription ? (
                            <Badge variant="outline">
                              {SUB_LABEL[org.subscription.status] ??
                                org.subscription.status}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org._count.orders.toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(org.createdAt), 'd MMM yyyy', { locale: tr })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {org.lastActivityAt
                          ? format(new Date(org.lastActivityAt), 'd MMM yyyy HH:mm', {
                              locale: tr,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" aria-label="Menü">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(`/admin/organizations/${org.id}`);
                              }}
                            >
                              Detay
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
                              Paket değiştir
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {org.suspended ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  unsuspendMutation.mutate(org.id);
                                }}
                              >
                                Askıyı kaldır
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSuspendTargetId(org.id);
                                  setSuspendOpen(true);
                                }}
                              >
                                Askıya al
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                void handleImpersonate(org.id, org.name);
                              }}
                              disabled={impersonateMutation.isPending}
                            >
                              <UserCircle2 className="mr-2 size-4" aria-hidden />
                              Hesaba giriş
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Toplam {total.toLocaleString('tr-TR')} organizasyon — Sayfa {page} /{' '}
              {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                Önceki
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5" aria-hidden />
              Organizasyonu askıya al
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Gerekçe</Label>
            <Textarea
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => {
                setSuspendReason(e.target.value);
              }}
              placeholder="Kısa açıklama yazın…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuspendOpen(false)}>
              Vazgeç
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
                'Askıya al'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paket değiştir</DialogTitle>
          </DialogHeader>
          {planTarget ? (
            <p className="text-sm text-muted-foreground">
              {planTarget.name}
              {planTarget.current ? (
                <>
                  {' '}
                  — Mevcut:{' '}
                  <span className="font-medium text-foreground">
                    {PLAN_LABEL[planTarget.current] ?? planTarget.current}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Yeni paket</Label>
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
                  {PLAN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-reason">Gerekçe</Label>
              <Textarea
                id="plan-reason"
                value={planReason}
                onChange={(e) => {
                  setPlanReason(e.target.value);
                }}
                rows={3}
                placeholder="Değişiklik notu…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
              Vazgeç
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
                'Kaydet'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
