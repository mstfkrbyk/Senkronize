import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { PlanTier, SubscriptionRecord } from '@/types/subscription';

const PLAN_LABELS: Record<PlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const PLAN_FEATURES: Partial<Record<PlanTier, string[]>> = {
  BASLANGIC: ['3 pazaryeri', '500 sipariş/ay', 'Temel senkronizasyon'],
  GELISIM: ['10 pazaryeri', 'BuyBox & webhook', 'Çoklu para birimi'],
  PRO: ['25 pazaryeri', 'BuyBox AI', 'API erişimi'],
  KURUMSAL: ['Sınırsız entegrasyon', 'Özel destek', 'White-label'],
};

function storedPlan(): PlanTier | null {
  const raw = sessionStorage.getItem('iyzico_checkout_plan');
  if (
    raw === 'BASLANGIC' ||
    raw === 'GELISIM' ||
    raw === 'PRO' ||
    raw === 'KURUMSAL'
  ) {
    return raw;
  }
  return null;
}

export function PaymentSuccessPage(): ReactElement {
  const subQuery = useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: async (): Promise<SubscriptionRecord> => {
      const { data } = await api.get<SubscriptionRecord>('/subscriptions/me');
      return data;
    },
  });

  const plan = subQuery.data?.plan ?? storedPlan();
  const billingLabel =
    subQuery.data?.billingPeriod === 'MONTHLY' ? 'Aylık' : 'Yıllık';

  useEffect(() => {
    sessionStorage.removeItem('iyzico_checkout_token');
    sessionStorage.removeItem('iyzico_checkout_plan');

    const duration = 2_500;
    const end = Date.now() + duration;
    const frame = (): void => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#38bdf8', '#0f172a', '#22c55e'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#38bdf8', '#0f172a', '#22c55e'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center space-y-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
          <CardTitle className="text-2xl">Teşekkürler!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Ödemeniz başarıyla alındı. Aboneliğiniz aktifleştirildi; fatura
            e-posta adresinize gönderildi.
          </p>

          {subQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Plan bilgileri yükleniyor…
            </div>
          ) : plan ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
              <p className="font-medium">{PLAN_LABELS[plan]} Paketi</p>
              <p className="mt-1 text-muted-foreground">{billingLabel} abonelik</p>
              {PLAN_FEATURES[plan] ? (
                <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground">
                  {PLAN_FEATURES[plan]?.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Button asChild className="w-full sm:w-auto">
            <Link to="/dashboard">Panele Git</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
