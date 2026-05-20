import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';
import type { BillingPeriod, PlanTier } from '@/types/subscription';

interface CheckoutResponse {
  checkoutFormContent?: string;
  checkoutUrl?: string;
  token?: string;
  conversationId: string;
  tokenExpireTime?: number;
}

const PLAN_LABELS: Record<PlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [formHtml, setFormHtml] = useState<string | null>(null);
  const started = useRef(false);

  const planParam = params.get('plan');
  const billingParam = params.get('billingPeriod') ?? 'YEARLY';
  const plan = isPlanTier(planParam) ? planParam : null;
  const billingPeriod = isBillingPeriod(billingParam) ? billingParam : 'YEARLY';

  const checkoutMutation = useMutation({
    mutationFn: async (): Promise<CheckoutResponse> => {
      if (!plan) {
        throw new Error('Geçersiz paket seçimi');
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
      toast.error('Ödeme formu yüklenemedi.');
      navigate('/payment/failure', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
      navigate('/payment/failure', { replace: true });
    },
  });

  useEffect(() => {
    if (!plan) {
      toast.error('Ödeme için geçerli bir paket seçilmedi.');
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

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {PLAN_LABELS[plan]} paketi —{' '}
            {billingPeriod === 'YEARLY' ? 'Yıllık' : 'Aylık'} ödeme
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkoutMutation.isPending || !formHtml ? (
            <div className="flex flex-col items-center gap-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p>Güvenli ödeme formu yükleniyor…</p>
            </div>
          ) : (
            <div
              ref={formRef}
              className="iyzico-checkout-container min-h-[420px] w-full"
              aria-label="Iyzico ödeme formu"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
