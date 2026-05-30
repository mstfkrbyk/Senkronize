import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import type { BillingPeriod, PlanTier } from '@/types/subscription';

interface CheckoutResponse {
  checkoutFormContent?: string;
  checkoutUrl?: string;
  token?: string;
  conversationId: string;
  tokenExpireTime?: number;
}

function isPlanTier(value: string | null): value is PlanTier {
  return (
    value === 'BASLANGIC' ||
    value === 'GELISIM' ||
    value === 'PRO' ||
    value === 'KURUMSAL'
  );
}

function isBillingPeriod(value: string | null): value is BillingPeriod {
  return value === 'MONTHLY' || value === 'YEARLY';
}

function mountCheckoutScripts(container: HTMLElement): void {
  const scripts = container.querySelectorAll('script');
  scripts.forEach((oldScript) => {
    const newScript = document.createElement('script');
    for (const attr of oldScript.attributes) {
      newScript.setAttribute(attr.name, attr.value);
    }
    newScript.text = oldScript.text;
    oldScript.replaceWith(newScript);
  });
}

export function PaymentPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('payment.pageTitle'));

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [formHtml, setFormHtml] = useState<string | null>(null);
  const started = useRef(false);

  const planParam = params.get('plan');
  const billingParam = params.get('billingPeriod') ?? 'YEARLY';
  const plan = isPlanTier(planParam) ? planParam : null;
  const billingPeriod = isBillingPeriod(billingParam) ? billingParam : 'YEARLY';

  const billingLabel =
    billingPeriod === 'YEARLY'
      ? t('payment.billing.yearly')
      : t('payment.billing.monthly');

  const checkoutMutation = useMutation({
    mutationFn: async (): Promise<CheckoutResponse> => {
      if (!plan) {
        throw new Error(t('payment.checkout.invalidPlan'));
      }
      const { data } = await api.post<CheckoutResponse>('/subscriptions/start', {
        plan,
        billingPeriod,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutFormContent) {
        setFormHtml(data.checkoutFormContent);
        if (data.token) {
          sessionStorage.setItem('iyzico_checkout_token', data.token);
        }
        if (plan) {
          sessionStorage.setItem('iyzico_checkout_plan', plan);
        }
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      toast.error(t('payment.checkout.formLoadFailed'));
      navigate('/payment/failure', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
      navigate('/payment/failure', { replace: true });
    },
  });

  useEffect(() => {
    if (!plan) {
      toast.error(t('payment.checkout.noPlanSelected'));
      navigate('/settings/subscription', { replace: true });
      return;
    }
    if (started.current) {
      return;
    }
    started.current = true;
    checkoutMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tek seferlik başlatma
  }, [plan, navigate]);

  useEffect(() => {
    if (!formHtml || !formRef.current) {
      return;
    }
    formRef.current.innerHTML = formHtml;
    mountCheckoutScripts(formRef.current);
  }, [formHtml]);

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const planLabel = t(`payment.plans.${plan}`);

  return (
    <div className="mx-auto min-h-[60vh] max-w-2xl space-y-6 p-6">
      <PageHeader
        title={t('payment.pageTitle')}
        description={t('payment.checkout.title', { plan: planLabel, period: billingLabel })}
      />
      <Card>
        <CardContent className="pt-6">
          {checkoutMutation.isPending || !formHtml ? (
            <div className="flex flex-col items-center gap-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p>{t('payment.checkout.loadingForm')}</p>
            </div>
          ) : (
            <div
              ref={formRef}
              className="iyzico-checkout-container min-h-[420px] w-full"
              aria-label={t('payment.checkout.formAriaLabel')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
