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
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PlanTier, PaymentRecord, SubscriptionRecord } from '@/types/subscription';

const PAYTR_IFRAME_BASE = 'https://www.paytr.com/odeme/guvenli/';

const PLANS: Array<{
  id: PlanTier;
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    id: 'BASLANGIC',
    name: 'Başlangıç',
    price: 499,
    features: ['2 pazaryeri', '500 ürün', 'Manuel sync'],
  },
  {
    id: 'GELISIM',
    name: 'Gelişim',
    price: 999,
    features: [
      '5 pazaryeri',
      '2.000 ürün',
      'Otomatik sync',
      'ERP entegrasyonu',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 1999,
    features: [
      'Sınırsız pazaryeri',
      'Sınırsız ürün',
      'BuyBox optimizasyonu',
      'AI fiyatlandırma',
      'Öncelikli destek',
    ],
    highlighted: true,
  },
];

function planLabel(id: PlanTier): string {
  const map: Partial<Record<PlanTier, string>> = {
    KURUMSAL: 'Kurumsal',
  };
  return PLANS.find((p) => p.id === id)?.name ?? map[id] ?? id;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    TRIAL: 'Deneme',
    ACTIVE: 'Aktif',
    PAUSED: 'Duraklatıldı',
    CANCELLED: 'İptal talebi',
    EXPIRED: 'Süresi doldu',
  };
  return map[status] ?? status;
}

function paymentStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Beklemede',
    SUCCESS: 'Başarılı',
    FAILED: 'Başarısız',
  };
  return map[s] ?? s;
}

export function SubscriptionTab(): ReactElement {
  const queryClient = useQueryClient();
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);

  const subQuery = useQuery({
    queryKey: ['subscriptions', 'me'],
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

  const paymentsQuery = useQuery({
    queryKey: ['subscriptions', 'payments'],
    queryFn: async () => {
      const { data } = await api.get<{
        items: PaymentRecord[];
        total: number;
        page: number;
        limit: number;
      }>('/subscriptions/payments', { params: { page: 1, limit: 20 } });
      return data;
    },
    enabled: subQuery.isSuccess,
  });

  const currentPlan = subQuery.data?.plan ?? null;

  const checkoutMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<{ iframeToken: string }> => {
      const { data } = await api.post<{ iframeToken: string; merchantOid: string }>(
        '/subscriptions/checkout',
        { plan },
      );
      return data;
    },
    onSuccess: (data) => {
      setCheckoutToken(data.iframeToken);
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
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Abonelik iptali talebiniz alındı.');
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
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
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
                  ₺{plan.price}
                  <span className="text-sm font-normal text-muted-foreground"> / ay</span>
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
                        currency: 'TRY',
                      }).format(p.amount / 100)}
                    </TableCell>
                    <TableCell>{paymentStatusLabel(p.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <Dialog open={checkoutToken != null} onOpenChange={() => setCheckoutToken(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>PayTR ödeme</DialogTitle>
          </DialogHeader>
          {checkoutToken ? (
            <iframe
              title="PayTR ödeme"
              className="h-[560px] w-full rounded-md border"
              src={`${PAYTR_IFRAME_BASE}${checkoutToken}`}
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
