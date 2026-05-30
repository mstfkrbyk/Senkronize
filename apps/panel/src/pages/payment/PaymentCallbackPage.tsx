import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';

export function PaymentCallbackPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('payment.callbackPageTitle'));

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;

    const token = params.get('token') ?? params.get('checkoutFormToken');
    if (!token) {
      toast.error(t('payment.callback.missingToken'));
      navigate('/payment/failure', { replace: true });
      return;
    }

    void (async (): Promise<void> => {
      try {
        const { data } = await api.post<{ success: boolean; message: string }>(
          '/subscriptions/iyzico/callback',
          { token },
        );
        if (data.success) {
          navigate('/payment/success', { replace: true });
          return;
        }
        toast.error(data.message);
        navigate('/payment/failure', { replace: true });
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e));
        navigate('/payment/failure', { replace: true });
      }
    })();
  }, [navigate, params, t]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">{t('payment.callback.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          {t('payment.callback.description')}
        </CardContent>
      </Card>
    </div>
  );
}
