import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/api';
import type { PlanTier, SubscriptionRecord } from '@/types/subscription';

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

function planFeatures(t: (key: string, options?: { returnObjects?: boolean }) => string, plan: PlanTier): string[] {
  const features = t(`payment.success.features.${plan}`, { returnObjects: true });
  return Array.isArray(features) ? features : [];
}

export function PaymentSuccessPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('payment.successPageTitle'));

  const subQuery = useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: async (): Promise<SubscriptionRecord> => {
      const { data } = await api.get<SubscriptionRecord>('/subscriptions/me');
      return data;
    },
  });

  const plan = subQuery.data?.plan ?? storedPlan();
  const billingLabel =
    subQuery.data?.billingPeriod === 'MONTHLY'
      ? t('payment.billing.monthly')
      : t('payment.billing.yearly');

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

  const features = plan ? planFeatures(t, plan) : [];

  return (
    <div className="mx-auto min-h-[60vh] max-w-lg space-y-6 p-6">
      <PageHeader
        title={t('payment.successPageTitle')}
        description={t('payment.success.description')}
      />
      <Card className="w-full text-center">
        <CardHeader className="items-center space-y-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
          <CardTitle className="text-2xl">{t('payment.success.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {subQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('payment.success.loadingPlan')}
            </div>
          ) : plan ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
              <p className="font-medium">
                {t('payment.success.planPackage', { plan: t(`payment.plans.${plan}`) })}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t('payment.success.subscriptionLabel', { period: billingLabel })}
              </p>
              {features.length > 0 ? (
                <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground">
                  {features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Button asChild className="w-full sm:w-auto">
            <Link to="/dashboard">{t('payment.success.goToPanel')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
