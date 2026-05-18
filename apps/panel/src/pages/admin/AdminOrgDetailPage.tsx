import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

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
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import type { AdminOrganizationDetailResponse } from '@/types/admin';

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
