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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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

const PLAN_RANK: Record<PlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

const PLANS: Array<{
  id: PlanTier;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}> = [
  {
    id: 'BASLANGIC',
    name: 'Başlangıç',
    price: 2_990,
    period: 'yıl',
    features: [
      '5 pazaryeri',
      '1.000 ürün',
      '500 sipariş/ay',
      'E-posta desteği',
    ],
    highlight: false,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 5_990,
    period: 'yıl',
    features: [
      '20 pazaryeri',
      '10.000 ürün',
      '5.000 sipariş/ay',
      'ERP entegrasyonu',
      'BuyBox optimizasyonu',
      'Öncelikli destek',
    ],
    highlight: true,
  },
  {
    id: 'KURUMSAL',
    name: 'Kurumsal',
    price: 11_990,
    period: 'yıl',
    features: [
      'Sınırsız pazaryeri',
      'Sınırsız ürün',
      'Sınırsız sipariş',
      'Tüm ERP entegrasyonları',
      'API erişimi',
      'Özel destek hattı',
      'White-label',
    ],
    highlight: false,
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

function planDisplayName(id: PlanTier): string {
  const fromList = PLANS.find((p) => p.id === id)?.name;
  if (fromList) {
    return fromList;
  }
  const map: Partial<Record<PlanTier, string>> = {
    GELISIM: 'Gelişim',
  };
  return map[id] ?? id;
}

function isHigherPlan(target: PlanTier, current: PlanTier | null): boolean {
  if (!current) {
    return true;
  }
  return PLAN_RANK[target] > PLAN_RANK[current];
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

function formatLimit(limit: number | null): string {
  if (limit == null) {
    return 'Sınırsız';
  }
  return limit.toLocaleString('tr-TR');
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
  const unlimited = limit == null;
  const pct = unlimited ? 0 : pctUsed(used, limit);
  const over = !unlimited && limit > 0 && used >= limit;
  const warn = !over && !unlimited && limit > 0 && pct >= 80;

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
          {' / '}
          {formatLimit(limit)}
        </span>
      </div>
      {!unlimited && limit > 0 ? (
        <Progress
          value={pct}
          className={cn(
            'h-2',
            over ? '[&>div]:bg-destructive' : warn ? '[&>div]:bg-amber-500' : '',
          )}
        />
      ) : unlimited ? (
        <Progress value={0} className="h-2 opacity-40" />
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
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<PlanTier | null>(null);
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

  const upgradeRequestMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<{ message: string }> => {
      const { data } = await api.patch<{ message: string }>('/subscriptions/plan', {
        plan,
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setUpgradeDialogOpen(false);
      setUpgradeTarget(null);
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

  const daysLeft = useMemo(() => {
    if (subQuery.data?.status !== 'TRIAL') {
      return null;
    }
    if (usageQuery.data?.trialDaysLeft != null) {
      return usageQuery.data.trialDaysLeft;
    }
    if (subQuery.data.trialEndsAt) {
      return Math.max(
        0,
        Math.ceil(
          (new Date(subQuery.data.trialEndsAt).getTime() - Date.now()) / 86_400_000,
        ),
      );
    }
    return null;
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

  function openUpgradeDialog(plan: PlanTier): void {
    track('plan_upgrade_clicked', {
      currentPlan: currentPlan ?? 'unknown',
      targetPlan: plan,
    });
    setUpgradeTarget(plan);
    setUpgradeDialogOpen(true);
  }

  const usage: UsageStats | undefined = usageQuery.data;
  const upgradeTargetName = upgradeTarget ? planDisplayName(upgradeTarget) : '';

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-primary">Abonelik</h3>
        <p className="text-sm text-muted-foreground">
          Paketinizi karşılaştırın, kullanımınızı izleyin ve faturalarınızı görüntüleyin.
        </p>
      </div>

      {subQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}

      {subQuery.isError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isAxiosError(subQuery.error) && subQuery.error.response?.status === 404
            ? 'Abonelik kaydı bulunamadı. Aşağıdan bir paket seçerek başlayabilirsiniz.'
            : getApiErrorMessage(subQuery.error)}
        </div>
      ) : null}

      {subQuery.isSuccess && subQuery.data?.status === 'TRIAL' && daysLeft != null ? (
        <Alert className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950">
          <AlertDescription>
            Deneme süreniz <strong>{daysLeft} gün</strong> içinde bitiyor. Hizmet kesintisi
            yaşamamak için plan seçin.
          </AlertDescription>
        </Alert>
      ) : null}

      {subQuery.isSuccess && subQuery.data ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Mevcut abonelik</CardTitle>
              <p className="text-sm text-muted-foreground">
                {planDisplayName(subQuery.data.plan)} · Dönem bitişi:{' '}
                {new Date(subQuery.data.currentPeriodEnd).toLocaleDateString('tr-TR')}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(subQuery.data.status)}>
              {statusLabel(subQuery.data.status)}
            </Badge>
          </CardHeader>
          {subQuery.data.status === 'CANCELLED' ? (
            <CardContent>
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
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kullanım metrikleri</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mevcut paketinizdeki kaynak kullanımı
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {usageQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {usageQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(usageQuery.error)}</p>
          ) : null}
          {usage ? (
            <>
              <UsageMetricRow
                label="Pazaryerleri"
                used={usage.connections.used}
                limit={usage.connections.limit}
              />
              <UsageMetricRow
                label="Ürünler"
                used={usage.products.used}
                limit={usage.products.limit}
              />
              <UsageMetricRow
                label="Bu ay sipariş"
                used={usage.orders.used}
                limit={usage.orders.limit}
              />
              <UsageMetricRow
                label="API anahtarları"
                used={usage.apiKeys.used}
                limit={usage.apiKeys.limit}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-base font-medium text-primary">Plan karşılaştırma</h4>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const canUpgrade = isHigherPlan(plan.id, currentPlan);
            const monthly = Math.round(plan.price / 12);

            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col border',
                  plan.highlight ? 'border-sky-400 ring-1 ring-sky-400/40' : '',
                  isCurrent ? 'border-primary/60 bg-primary/5' : '',
                )}
              >
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent ? (
                      <Badge variant="secondary">Aktif Plan</Badge>
                    ) : null}
                    {plan.highlight && !isCurrent ? (
                      <Badge className="border-0 bg-sky-500 text-white hover:bg-sky-500">
                        Önerilen
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-primary">
                      ₺{plan.price.toLocaleString('tr-TR')}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}
                        / {plan.period}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ≈ ₺{monthly.toLocaleString('tr-TR')} / ay
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    type="button"
                    className="w-full"
                    variant={canUpgrade ? 'default' : 'outline'}
                    disabled={!canUpgrade || isCurrent || upgradeRequestMutation.isPending}
                    onClick={() => {
                      if (canUpgrade) {
                        openUpgradeDialog(plan.id);
                      }
                    }}
                  >
                    {isCurrent ? 'Mevcut plan' : canUpgrade ? 'Yükselt' : 'Mevcut veya alt plan'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-base font-medium text-primary">Fatura geçmişi</h4>
        <p className="text-sm text-muted-foreground">
          Ödeme kayıtlarınız listelenir; resmi fatura PDF&apos;si yakında eklenecektir.
        </p>
        {invoicesQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {invoicesQuery.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(invoicesQuery.error)}</p>
        ) : null}
        {invoicesQuery.isSuccess && invoicesQuery.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz fatura kaydı yok.</p>
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
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesQuery.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {new Date(p.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
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
                          toast.message('Fatura indirme yakında eklenecek.');
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
      </div>

      {subQuery.isSuccess && subQuery.data?.status !== 'CANCELLED' ? (
        <div className="flex flex-wrap gap-3 border-t pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={checkoutMutation.isPending}
            onClick={() => {
              const plan = currentPlan ?? 'PRO';
              checkoutMutation.mutate(plan);
            }}
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            PayTR ile ödeme
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            Aboneliği iptal et
          </Button>
        </div>
      ) : null}

      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan yükseltme</AlertDialogTitle>
            <AlertDialogDescription>
              {upgradeTargetName
                ? `${upgradeTargetName} planına geçmek istiyorsunuz. Ödeme sistemi kurulunca aktif edilecektir. Devam etmek ister misiniz?`
                : 'Plan yükseltme talebi oluşturulacak. Devam etmek ister misiniz?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={!upgradeTarget || upgradeRequestMutation.isPending}
              onClick={() => {
                if (upgradeTarget) {
                  upgradeRequestMutation.mutate(upgradeTarget);
                }
              }}
            >
              {upgradeRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Onayla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
