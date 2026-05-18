import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, FileDown, Loader2 } from 'lucide-react';
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInvoices } from '@/hooks/useInvoices';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  PaymentStatus,
  PlanTier,
  SubscriptionRecord,
  SubscriptionStatus,
  UsageStats,
} from '@/types/subscription';

const PAYTR_IFRAME_BASE = 'https://www.paytr.com/odeme/guvenli/';

const TRIAL_TOTAL_DAYS = 14;

const PLAN_YEAR_PRICE_TRY: Record<PlanTier, number> = {
  BASLANGIC: 2_900,
  GELISIM: 5_900,
  PRO: 9_900,
  KURUMSAL: 19_900,
};

const PLANS: Array<{
  id: PlanTier;
  name: string;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    id: 'BASLANGIC',
    name: 'Başlangıç',
    features: [
      '500 sipariş / ay',
      '1 pazaryeri bağlantısı',
      '1 ERP bağlantısı',
      '2 kullanıcı',
    ],
  },
  {
    id: 'GELISIM',
    name: 'Gelişim',
    features: [
      '2.000 sipariş / ay',
      '3 pazaryeri bağlantısı',
      '2 ERP bağlantısı',
      '5 kullanıcı',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    features: [
      '10.000 sipariş / ay',
      '10 pazaryeri bağlantısı',
      '3 ERP bağlantısı',
      '15 kullanıcı',
      'BuyBox ve gelişmiş fiyatlandırma',
    ],
    highlighted: true,
  },
  {
    id: 'KURUMSAL',
    name: 'Kurumsal',
    features: [
      '100.000 sipariş / ay',
      '50 pazaryeri bağlantısı',
      '10 ERP bağlantısı',
      '100 kullanıcı',
      'Özel SLA ve destek',
    ],
  },
];

const CANCEL_PRESETS = [
  { value: 'cost', label: 'Maliyet yüksek' },
  { value: 'features', label: 'İhtiyaçlarımı karşılamadı' },
  { value: 'support', label: 'Destek yetersiz' },
  { value: 'other', label: 'Diğer' },
] as const;

function planLabel(id: PlanTier): string {
  return PLANS.find((p) => p.id === id)?.name ?? id;
}

function statusBadgeVariant(
  status: SubscriptionStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') {
    return 'default';
  }
  if (status === 'TRIAL') {
    return 'secondary';
  }
  if (status === 'CANCELLED') {
    return 'destructive';
  }
  return 'outline';
}

function statusLabel(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    TRIAL: 'Deneme',
    ACTIVE: 'Aktif',
    PAUSED: 'Duraklatıldı',
    CANCELLED: 'İptal edildi',
    EXPIRED: 'Süresi doldu',
  };
  return map[status] ?? status;
}

function invoiceStatusLabel(s: PaymentStatus): string {
  const map: Record<PaymentStatus, string> = {
    PENDING: 'Bekliyor',
    SUCCESS: 'Ödendi',
    FAILED: 'Başarısız',
    REFUNDED: 'İade',
  };
  return map[s] ?? s;
}

function PaymentStatusBadge({ status }: { status: string }): ReactElement {
  const s = status.toUpperCase() as PaymentStatus;
  if (s === 'SUCCESS') {
    return (
      <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600">
        {invoiceStatusLabel(s)}
      </Badge>
    );
  }
  if (s === 'FAILED') {
    return <Badge variant="destructive">{invoiceStatusLabel(s)}</Badge>;
  }
  if (s === 'REFUNDED') {
    return <Badge variant="secondary">{invoiceStatusLabel(s)}</Badge>;
  }
  return (
    <Badge className="border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100">
      {invoiceStatusLabel('PENDING')}
    </Badge>
  );
}

function pctUsed(used: number, limit: number | null): number {
  if (limit == null || limit <= 0) {
    return 0;
  }
  return Math.min(100, (used / limit) * 100);
}

function UsageMetricRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}): ReactElement {
  const pct = pctUsed(used, limit);
  const over = limit != null && limit > 0 && used >= limit;
  const warn = !over && limit != null && limit > 0 && pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span
          className={cn(
            'tabular-nums',
            over ? 'font-semibold text-destructive' : warn ? 'font-medium text-amber-700' : '',
          )}
        >
          {used.toLocaleString('tr-TR')}
          {limit != null ? ` / ${limit.toLocaleString('tr-TR')}` : ''}
        </span>
      </div>
      {limit != null && limit > 0 ? (
        <Progress
          value={pct}
          className={cn(
            'h-2',
            over ? '[&>div]:bg-destructive' : warn ? '[&>div]:bg-amber-500' : '',
          )}
        />
      ) : null}
      {over ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <span>Limit doldu.</span>
          <a
            href="/settings/subscription"
            className="inline-flex h-7 items-center justify-center rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Paketini yükselt
          </a>
        </div>
      ) : null}
      {warn && !over ? (
        <p className="text-xs text-amber-800">
          Limitinize yaklaşıyorsunuz (%80 üzeri). İhtiyaç halinde paket yükseltmeyi düşünün.
        </p>
      ) : null}
    </div>
  );
}

export function SubscriptionTab(): ReactElement {
  const queryClient = useQueryClient();
  const [paytrToken, setPaytrToken] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [cancelPreset, setCancelPreset] = useState<string>(CANCEL_PRESETS[0].value);
  const [cancelDetail, setCancelDetail] = useState('');

  const subQuery = useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: async (): Promise<SubscriptionRecord> => {
      const { data } = await api.get<SubscriptionRecord>('/subscriptions/me');
      return data;
    },
    retry: (count, err) => {
      if (isAxiosError(err) && err.response?.status === 404) {
        return false;
      }
      return count < 2;
    },
  });

  const usageQuery = useSubscriptionUsage(subQuery.isSuccess);
  const invoicesQuery = useInvoices(subQuery.isSuccess);

  const currentPlan = subQuery.data?.plan ?? null;

  const checkoutMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<{ token: string }> => {
      const { data } = await api.post<{
        token: string;
        iframeToken: string;
        merchantOid: string;
      }>('/subscriptions/checkout', { plan });
      const token = data.token ?? data.iframeToken;
      return { token };
    },
    onSuccess: ({ token }) => {
      setPaytrToken(token);
      setShowPayment(true);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<void> => {
      await api.post('/subscriptions/change-plan', { plan });
    },
    onSuccess: () => {
      toast.success('Paketiniz güncellendi.');
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void usageQuery.refetch();
      setPlanDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string | undefined): Promise<void> => {
      await api.post('/subscriptions/cancel', { reason });
    },
    onSuccess: () => {
      toast.success('İptal talebiniz kaydedildi; dönem sonuna kadar erişiminiz sürer.');
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setCancelOpen(false);
      setCancelDetail('');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/subscriptions/reactivate');
    },
    onSuccess: () => {
      toast.success('Aboneliğiniz yeniden etkinleştirildi.');
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const payPlan = selectedPlan ?? currentPlan ?? 'GELISIM';

  const trialProgressPct = useMemo(() => {
    if (subQuery.data?.status !== 'TRIAL') {
      return null;
    }
    const left =
      usageQuery.data?.trialDaysLeft ??
      (subQuery.data.trialEndsAt
        ? Math.max(
            0,
            Math.ceil(
              (new Date(subQuery.data.trialEndsAt).getTime() - Date.now()) / 86_400_000,
            ),
          )
        : null);
    if (left == null) {
      return null;
    }
    return Math.min(100, Math.max(0, ((TRIAL_TOTAL_DAYS - left) / TRIAL_TOTAL_DAYS) * 100));
  }, [subQuery.data, usageQuery.data?.trialDaysLeft]);

  function buildCancelReason(): string | undefined {
    const preset = CANCEL_PRESETS.find((p) => p.value === cancelPreset)?.label ?? cancelPreset;
    const detail = cancelDetail.trim();
    if (cancelPreset === 'other' && detail) {
      return `${preset}: ${detail}`;
    }
    if (cancelPreset === 'other' && !detail) {
      return preset;
    }
    if (detail) {
      return `${preset} — ${detail}`;
    }
    return preset;
  }

  const usage: UsageStats | undefined = usageQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-primary">Abonelik</h3>
        <p className="text-sm text-muted-foreground">
          Paketinizi yönetin, kullanımınızı izleyin ve faturalarınızı görüntüleyin.
        </p>
      </div>

      {subQuery.isLoading ? <Skeleton className="h-24 w-full max-w-xl" /> : null}

      {subQuery.isError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isAxiosError(subQuery.error) && subQuery.error.response?.status === 404
            ? 'Abonelik kaydı bulunamadı. Aşağıdan bir paket seçerek başlayabilirsiniz.'
            : getApiErrorMessage(subQuery.error)}
        </div>
      ) : null}

      {subQuery.isSuccess && subQuery.data ? (
        <Tabs defaultValue="overview" className="w-full space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Özet</TabsTrigger>
            <TabsTrigger value="invoices">Fatura geçmişi</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{planLabel(subQuery.data.plan)}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Yıllık ücret:{' '}
                    <span className="font-semibold text-foreground">
                      ₺{PLAN_YEAR_PRICE_TRY[subQuery.data.plan].toLocaleString('tr-TR')}
                    </span>
                  </p>
                </div>
                <Badge variant={statusBadgeVariant(subQuery.data.status)}>
                  {statusLabel(subQuery.data.status)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <p>
                    <span className="text-muted-foreground">Dönem bitişi:</span>{' '}
                    <span className="font-medium">
                      {new Date(subQuery.data.currentPeriodEnd).toLocaleDateString('tr-TR')}
                    </span>
                  </p>
                  {subQuery.data.nextBillingAt ? (
                    <p>
                      <span className="text-muted-foreground">Sonraki ödeme:</span>{' '}
                      <span className="font-medium">
                        {new Date(subQuery.data.nextBillingAt).toLocaleDateString('tr-TR')}
                      </span>
                    </p>
                  ) : null}
                </div>

                {subQuery.data.status === 'TRIAL' && trialProgressPct != null ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <div className="flex justify-between text-sm text-amber-950">
                      <span>Deneme süresi</span>
                      <span className="font-semibold">
                        {usage?.trialDaysLeft != null
                          ? `${usage.trialDaysLeft} gün kaldı`
                          : 'Aktif'}
                      </span>
                    </div>
                    <Progress
                      value={trialProgressPct}
                      className="h-2 [&>div]:bg-amber-600"
                    />
                  </div>
                ) : null}

                {subQuery.data.status === 'CANCELLED' ? (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950"
                    role="status"
                  >
                    <p className="font-medium">İptal talebiniz kayıtlı.</p>
                    <p className="mt-1">
                      <span className="font-semibold">
                        {new Date(subQuery.data.currentPeriodEnd).toLocaleDateString('tr-TR')}
                      </span>{' '}
                      tarihine kadar erişiminiz devam eder.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      disabled={reactivateMutation.isPending}
                      onClick={() => {
                        reactivateMutation.mutate();
                      }}
                    >
                      {reactivateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      ) : null}
                      Yeniden aktifleştir
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kullanım</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {usageQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}
                {usageQuery.isError ? (
                  <p className="text-sm text-destructive">{getApiErrorMessage(usageQuery.error)}</p>
                ) : null}
                {usage ? (
                  <>
                    <UsageMetricRow
                      label="Bu ay siparişler"
                      used={usage.orders.used}
                      limit={usage.orders.limit}
                    />
                    <UsageMetricRow
                      label="Pazaryeri bağlantıları"
                      used={usage.marketplaces.used}
                      limit={usage.marketplaces.limit}
                    />
                    <UsageMetricRow
                      label="E-ticaret bağlantıları"
                      used={usage.ecommerce.used}
                      limit={usage.ecommerce.limit}
                    />
                    <UsageMetricRow
                      label="ERP bağlantıları"
                      used={usage.erp.used}
                      limit={usage.erp.limit}
                    />
                    <UsageMetricRow
                      label="Kullanıcılar"
                      used={usage.users.used}
                      limit={usage.users.limit}
                    />
                  </>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  setPlanDialogOpen(true);
                }}
              >
                Planı değiştir
              </Button>
              <Button
                type="button"
                disabled={checkoutMutation.isPending}
                variant="secondary"
                onClick={() => {
                  track('plan_upgrade_clicked', {
                    currentPlan: currentPlan ?? 'unknown',
                    targetPlan: payPlan,
                  });
                  checkoutMutation.mutate(payPlan);
                }}
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                PayTR ile ödeme
              </Button>
              {subQuery.data.status !== 'CANCELLED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  Aboneliği iptal et
                </Button>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ödeme kayıtlarınız fatura yerine listelenir; resmi fatura PDF&apos;si yakında
              eklenecektir.
            </p>
            {invoicesQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {invoicesQuery.isError ? (
              <p className="text-sm text-destructive">{getApiErrorMessage(invoicesQuery.error)}</p>
            ) : null}
            {invoicesQuery.isSuccess && invoicesQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz fatura / ödeme kaydı yok.</p>
            ) : null}
            {invoicesQuery.isSuccess && invoicesQuery.data.items.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Tutar</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesQuery.data.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {new Date(p.createdAt).toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell>{planLabel(p.plan)}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: p.currency === 'TRY' || !p.currency ? 'TRY' : p.currency,
                          }).format(p.amount / 100)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              toast.message('PDF indirme yakında eklenecek.');
                            }}
                          >
                            <FileDown className="h-4 w-4" aria-hidden />
                            İndir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-base font-medium text-primary">Paket seçimi (ödeme)</h4>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col',
                  plan.highlighted ? 'border-sky-400 ring-1 ring-sky-400/40' : '',
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent ? <Badge variant="secondary">Mevcut</Badge> : null}
                  </div>
                  <p className="text-2xl font-semibold text-primary">
                    ₺{PLAN_YEAR_PRICE_TRY[plan.id].toLocaleString('tr-TR')}
                    <span className="text-sm font-normal text-muted-foreground"> / yıl</span>
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <ul className="list-inside list-disc space-y-1">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    type="button"
                    variant={selectedPlan === plan.id ? 'default' : 'outline'}
                    className="w-full gap-1"
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {selectedPlan === plan.id ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden />
                        Seçildi
                      </>
                    ) : (
                      'Seç'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planı değiştir</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={cn(isCurrent ? 'border-sky-400 ring-1 ring-sky-400/50' : '')}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {isCurrent ? <Badge>Mevcut</Badge> : null}
                    </div>
                    <p className="text-lg font-semibold">
                      ₺{PLAN_YEAR_PRICE_TRY[plan.id].toLocaleString('tr-TR')}
                      <span className="text-xs font-normal text-muted-foreground"> / yıl</span>
                    </p>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <ul className="list-inside list-disc space-y-1">
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isCurrent || changePlanMutation.isPending}
                      onClick={() => {
                        track('plan_upgrade_clicked', {
                          currentPlan: currentPlan ?? 'unknown',
                          targetPlan: plan.id,
                        });
                        changePlanMutation.mutate(plan.id);
                      }}
                    >
                      {isCurrent ? 'Mevcut plan' : 'Yükselt / değiştir'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPayment && paytrToken != null}
        onOpenChange={(open) => {
          if (!open) {
            setShowPayment(false);
            setPaytrToken(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Güvenli ödeme</DialogTitle>
          </DialogHeader>
          {paytrToken ? (
            <iframe
              title="PayTR güvenli ödeme"
              src={`${PAYTR_IFRAME_BASE}${paytrToken}`}
              className="w-full rounded-md border-0"
              height={600}
              scrolling="no"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aboneliği iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              İptal sonrası mevcut dönem bitimine kadar erişiminiz devam eder. Devam etmek
              istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>İptal nedeni</Label>
              <Select value={cancelPreset} onValueChange={setCancelPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-detail">Ek not (isteğe bağlı)</Label>
              <Textarea
                id="cancel-detail"
                rows={3}
                value={cancelDetail}
                maxLength={500}
                onChange={(e) => setCancelDetail(e.target.value)}
                placeholder="Kısa açıklama yazabilirsiniz."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={() => {
                cancelMutation.mutate(buildCancelReason());
              }}
            >
              İptali onayla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
