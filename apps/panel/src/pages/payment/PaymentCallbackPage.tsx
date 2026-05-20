import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';

export function PaymentCallbackPage(): ReactElement {
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
      toast.error('Ödeme doğrulama bilgisi eksik.');
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
  }, [navigate, params]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Ödeme doğrulanıyor</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          Lütfen bekleyin, aboneliğiniz etkinleştiriliyor…
        </CardContent>
      </Card>
    </div>
  );
}
