import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import type {
  AdminActivitySummary,
  AdminOrgNote,
  AdminOrganizationDetailResponse,
} from '@/types/admin';

const SUB_LABEL: Record<string, string> = {
  TRIAL: 'Deneme',
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi doldu',
};

const PLAN_LABEL: Record<string, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const PAY_STATUS: Record<string, string> = {
  PENDING: 'Beklemede',
  SUCCESS: 'Başarılı',
  FAILED: 'Başarısız',
  REFUNDED: 'İade',
};

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

export function AdminOrgDetailPage(): ReactElement {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'organization', orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<AdminOrganizationDetailResponse> => {
      const { data: res } = await api.get<AdminOrganizationDetailResponse>(
        `/admin/organizations/${orgId}`,
      );
      return res;
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
      const { data: res } = await api.get<AdminOrgNote[]>(
        `/admin/organizations/${orgId}/notes`,
      );
      return res;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      await api.post(`/admin/organizations/${orgId}/notes`, { note });
    },
    onSuccess: () => {
      setNoteDraft('');
      void refetchNotes();
      toast.success('Not eklendi.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/organizations/${orgId}`);
    },
    onSuccess: () => {
      toast.success('Organizasyon silindi.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      navigate('/admin/organizations');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/admin/organizations/${orgId}/export`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${data?.organization.slug ?? orgId}-export.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Dışa aktarma indirildi.'),
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  if (!orgId) {
    return (
      <div className="text-sm text-destructive">Geçersiz adres.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
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
    );
  }

  const { organization: o, subscription: sub } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/admin/organizations">
            <ArrowLeft className="mr-1 size-4" aria-hidden />
            Listeye dön
          </Link>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <Building2 className="size-6 text-sky-600" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-xl">{o.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {o.slug}
                {o.taxNumber ? ` · VKN ${o.taxNumber}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.suspended ? (
                  <Badge variant="destructive">Askıda</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                    Çalışıyor
                  </Badge>
                )}
                {sub ? (
                  <>
                    <Badge variant="secondary">
                      {PLAN_LABEL[sub.plan] ?? sub.plan}
                    </Badge>
                    <Badge variant="outline">
                      {SUB_LABEL[sub.status] ?? sub.status}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline">Abonelik yok</Badge>
                )}
              </div>
            </div>
          </div>
          {sub ? (
            <div className="text-right text-xs text-muted-foreground">
              <p>
                Dönem:{' '}
                {format(new Date(sub.currentPeriodStart), 'd MMM yyyy', {
                  locale: tr,
                })}{' '}
                —{' '}
                {format(new Date(sub.currentPeriodEnd), 'd MMM yyyy', {
                  locale: tr,
                })}
              </p>
              {sub.trialEndsAt ? (
                <p className="mt-1">
                  Deneme bitişi:{' '}
                  {format(new Date(sub.trialEndsAt), 'd MMM yyyy', { locale: tr })}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivite özeti</CardTitle>
            <p className="text-sm text-muted-foreground">Son 30 gün</p>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activity?.syncCount ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">Sync</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activity?.orderCount ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">Sipariş</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-destructive">
                {activity?.errorCount ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">Hata</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="İç not ekleyin…"
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
                onClick={() => void addNoteMutation.mutate(noteDraft.trim())}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                Not ekle
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz not yok.</p>
            ) : (
              <ul className="max-h-48 space-y-3 overflow-y-auto">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {format(new Date(n.createdAt), 'd MMM yyyy HH:mm', {
                        locale: tr,
                      })}
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
            Tehlikeli işlemler
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={exportMutation.isPending}
            onClick={() => void exportMutation.mutate()}
          >
            {exportMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 size-4" aria-hidden />
            )}
            Veriyi dışa aktar (ZIP)
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" aria-hidden />
            Organizasyonu sil
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Organizasyonu sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem organizasyonu kalıcı olarak askıya alır ve soft-delete
              uygular. Tüm kullanıcı oturumları etkilenebilir. Devam etmek
              istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrgMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void deleteOrgMutation.mutateAsync();
              }}
            >
              {deleteOrgMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Evet, sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">Genel bilgi</TabsTrigger>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="connections">Bağlantılar</TabsTrigger>
          <TabsTrigger value="orders">Son siparişler</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="invoices">Fatura geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">İletişim ve adres</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Vergi dairesi</p>
                <p className="font-medium">{o.taxOffice ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Şehir</p>
                <p className="font-medium">{o.city ?? '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Adres</p>
                <p className="font-medium">{o.address ?? '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Web sitesi</p>
                <p className="font-medium">{o.website ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kayıt tarihi</p>
                <p className="font-medium">
                  {format(new Date(o.createdAt), 'd MMMM yyyy', { locale: tr })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Organizasyon tipi</p>
                <p className="font-medium">{o.type}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Son giriş</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Kullanıcı yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.role}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.lastLoginAt
                            ? format(new Date(u.lastLoginAt), 'd MMM yyyy HH:mm', {
                                locale: tr,
                              })
                            : '—'}
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son sync</TableHead>
                    <TableHead className="text-right">Hata sayısı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.marketplaceConnections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Pazaryeri bağlantısı yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.marketplaceConnections.map((c) => {
                      const meta = getMarketplaceDisplay(c.platform);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <span className="mr-1">{meta.logo}</span>
                            {meta.label}
                          </TableCell>
                          <TableCell>
                            {c.isActive ? (
                              <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                                Aktif
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pasif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.lastSyncAt
                              ? format(new Date(c.lastSyncAt), 'd MMM yyyy HH:mm', {
                                  locale: tr,
                                })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.syncErrorCount}
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

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Sipariş</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sipariş yok.
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
                          <TableCell>{ord.status}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {tryFormatter.format(Number(ord.totalAmount))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(ord.createdAt), 'd MMM HH:mm', {
                              locale: tr,
                            })}
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

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Eylem</TableHead>
                    <TableHead>Kaynak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAuditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Kayıt yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentAuditLogs.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(new Date(a.createdAt), 'd MMM yyyy HH:mm', {
                            locale: tr,
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{a.action}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.resourceType}
                          {a.resourceId ? ` · ${a.resourceId}` : ''}
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
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Ödeme kaydı yok.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(p.createdAt), 'd MMM yyyy HH:mm', {
                            locale: tr,
                          })}
                        </TableCell>
                        <TableCell>{PLAN_LABEL[p.plan] ?? p.plan}</TableCell>
                        <TableCell>{PAY_STATUS[p.status] ?? p.status}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {tryFormatter.format(p.amount / 100)}
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
    </div>
  );
}
