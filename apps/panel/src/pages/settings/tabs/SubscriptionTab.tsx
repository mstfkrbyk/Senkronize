import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, Loader2 } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentHistory } from '@/hooks/usePaymentHistory';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  PaymentStatus,
  PlanTier,
  SubscriptionRecord,
  SubscriptionStatus,
} from '@/types/subscription';

const PAYTR_IFRAME_BASE = 'https://www.paytr.com/odeme/guvenli/';

const PLANS: Array<{
  id: PlanTier;
  name: string;
  priceYear: number;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    id: 'BASLANGIC',
    name: 'Başlangıç',
    priceYear: 2900,
    features: ['2 pazaryeri', '500 sipariş / ay', 'Manuel sync'],
  },
  {
    id: 'GELISIM',
    name: 'Gelişim',
    priceYear: 5900,
    features: [
      '5 pazaryeri',
      '2.000 sipariş / ay',
      'Otomatik sync',
      'ERP entegrasyonu',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceYear: 9900,
    features: [
      'Sınırsız pazaryeri',
      'Sınırsız ürün',
      'BuyBox optimizasyonu',
      'AI fiyatlandırma',
      'Öncelikli destek',
    ],
    highlighted: true,
  },
  {
    id: 'KURUMSAL',
    name: 'Kurumsal',
    priceYear: 19_900,
    features: [
      'Yüksek limitler',
      'Özel SLA',
      'Dedicated destek',
      'Özel entegrasyon',
    ],
  },
];

function planLabel(id: PlanTier): string {
  return PLANS.find((p) => p.id === id)?.name ?? id;
}

function statusLabel(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    TRIAL: 'Deneme',
    ACTIVE: 'Aktif',
    PAUSED: 'Duraklatıldı',
    CANCELLED: 'İptal talebi',
    EXPIRED: 'Süresi doldu',
  };
  return map[status] ?? status;
}

function paymentStatusLabel(s: PaymentStatus): string {
  const map: Record<PaymentStatus, string> = {
    PENDING: 'Beklemede',
    SUCCESS: 'Başarılı',
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
        {paymentStatusLabel(s)}
      </Badge>
    );
  }
  if (s === 'FAILED') {
    return (
      <Badge variant="destructive">{paymentStatusLabel(s)}</Badge>
    );
  }
  if (s === 'REFUNDED') {
    return (
      <Badge variant="secondary">{paymentStatusLabel(s)}</Badge>
    );
  }
  return (
    <Badge className="border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100">
      {paymentStatusLabel('PENDING')}
    </Badge>
  );
}

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) {
    return null;
  }
  const end = new Date(trialEndsAt).getTime();
  const diff = Math.ceil((end - Date.now()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function SubscriptionStatusBanner({
  sub,
}: {
  sub: SubscriptionRecord;
}): ReactElement | null {
  const endLabel = new Date(sub.currentPeriodEnd).toLocaleDateString('tr-TR');
  const nextPay =
    sub.nextBillingAt != null
      ? new Date(sub.nextBillingAt).toLocaleDateString('tr-TR')
      : endLabel;
  const trialLeft = trialDaysLeft(sub.trialEndsAt);

  if (sub.status === 'TRIAL') {
    if (trialLeft != null) {
      return (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <strong>Deneme süresi:</strong> 14 günlük denemeniz{' '}
          <span className="font-semibold">{trialLeft} gün</span> daha devam ediyor.
        </div>
      );
    }
    return (
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        <strong>Deneme süresi:</strong> Deneme paketiniz aktif.
      </div>
    );
  }

  if (sub.status === 'ACTIVE') {
    return (
      <div
        className="flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <span>
          <strong>{planLabel(sub.plan)}</strong> paketiniz aktif.
        </span>
        <Badge className="w-fit border-0 bg-emerald-600 text-white hover:bg-emerald-600">
          Sonraki ödeme: {nextPay}
        </Badge>
      </div>
    );
  }

  if (sub.status === 'CANCELLED') {
    return (
      <div
        className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950"
        role="status"
      >
        <strong>İptal talebi:</strong> Aboneliğiniz{' '}
        <span className="font-semibold">{endLabel}</span> tarihinde sona erecek.
      </div>
    );
  }

  if (sub.status === 'EXPIRED') {
    return (
      <div
        className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900"
        role="status"
      >
        <p className="font-medium">Aboneliğiniz sona erdi.</p>
        <p className="mt-1 text-muted-foreground">
          Hizmete devam etmek için aşağıdan bir paket seçip ödeme yapın.
        </p>
      </div>
    );
  }

  return null;
}

export function SubscriptionTab(): ReactElement {
  const queryClient = useQueryClient();
  const [paytrToken, setPaytrToken] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);

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

  const paymentsQuery = usePaymentHistory(subQuery.isSuccess);

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

  const cancelMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/subscriptions/cancel');
    },
    onSuccess: () => {
      toast.success('Aboneliğiniz dönem sonunda iptal edilecek.');
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setCancelOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const payPlan = selectedPlan ?? currentPlan ?? 'GELISIM';

  const planCards = useMemo(() => PLANS, []);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-primary">Abonelik</h3>
        <p className="text-sm text-muted-foreground">
          Paketinizi seçin, PayTR ile güvenli ödeme yapın veya aboneliğinizi yönetin.
        </p>
      </div>

      {subQuery.isLoading ? (
        <Skeleton className="h-24 w-full max-w-xl" />
      ) : null}

      {subQuery.isError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isAxiosError(subQuery.error) && subQuery.error.response?.status === 404
            ? 'Abonelik kaydı bulunamadı. Aşağıdan bir paket seçerek başlayabilirsiniz.'
            : getApiErrorMessage(subQuery.error)}
        </div>
      ) : null}

      {subQuery.isSuccess && subQuery.data ? (
        <div className="space-y-4">
          <SubscriptionStatusBanner sub={subQuery.data} />
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-base">Mevcut paket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Plan:</span>{' '}
                <span className="font-medium">{planLabel(subQuery.data.plan)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Durum:</span>{' '}
                {statusLabel(subQuery.data.status)}
              </p>
              <p>
                <span className="text-muted-foreground">Dönem sonu:</span>{' '}
                {new Date(subQuery.data.currentPeriodEnd).toLocaleDateString('tr-TR')}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {planCards.map((plan) => {
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
                  {isCurrent ? (
                    <Badge variant="secondary">Mevcut</Badge>
                  ) : null}
                </div>
                <p className="text-2xl font-semibold text-primary">
                  ₺{plan.priceYear.toLocaleString('tr-TR')}
                  <span className="text-sm font-normal text-muted-foreground"> / yıl</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Aylık {Math.round(plan.priceYear / 12).toLocaleString('tr-TR')} ₺&apos;ye eşdeğer
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

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={checkoutMutation.isPending}
          onClick={() => {
            checkoutMutation.mutate(payPlan);
          }}
        >
          {checkoutMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Ödeme yap
        </Button>
        <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
          Aboneliği iptal et
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-base font-medium text-primary">Ödeme geçmişi</h4>
        {paymentsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : null}
        {paymentsQuery.isError ? (
          <p className="text-sm text-destructive">
            {getApiErrorMessage(paymentsQuery.error)}
          </p>
        ) : null}
        {paymentsQuery.isSuccess && paymentsQuery.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz ödeme kaydı yok.</p>
        ) : null}
        {paymentsQuery.isSuccess && paymentsQuery.data.items.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsQuery.data.items.map((p) => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

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
            <DialogTitle>Güvenli Ödeme</DialogTitle>
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
              Aboneliğinizi iptal etmek istediğinize emin misiniz? Mevcut dönem sonuna kadar
              erişiminiz devam edebilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={() => {
                cancelMutation.mutate();
              }}
            >
              İptal talebi gönder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
