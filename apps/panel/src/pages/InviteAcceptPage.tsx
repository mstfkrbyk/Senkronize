import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useAcceptPartnerInvite } from '@/pages/partner/hooks/usePartner';
import { useAuthStore } from '@/store/auth.store';

export function InviteAcceptPage(): ReactElement {
  const { token: urlToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const jwt = useAuthStore((s) => s.token);
  const { mutate, isPending } = useAcceptPartnerInvite();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!urlToken) {
      setMessage('Geçersiz davet bağlantısı.');
    }
  }, [urlToken]);

  if (!urlToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Davet</CardTitle>
            <CardDescription>
              {message ?? 'Geçersiz davet bağlantısı.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!jwt) {
    const loginHref = `/login?inviteToken=${encodeURIComponent(urlToken)}`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Partner daveti</CardTitle>
            <CardDescription>
              Daveti kabul etmek için giriş yapmanız veya kayıt olmanız gerekir.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" asChild>
              <Link to={loginHref}>Giriş yap</Link>
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <Link to={`/register?inviteToken=${encodeURIComponent(urlToken)}`}>
                Kayıt ol
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (message) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Davet işlenemedi</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              Panele dön
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Partner daveti</CardTitle>
          <CardDescription>
            Partner ilişkisini kurmak için onaylayın. İşlem tamamlandığında panele
            yönlendirileceksiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-4">
          {isPending ? (
            <Loader2
              className="size-8 animate-spin text-muted-foreground"
              aria-label="Yükleniyor"
            />
          ) : null}
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              mutate(urlToken, {
                onSuccess: () => {
                  navigate('/dashboard', { replace: true });
                },
                onError: (error: unknown) => {
                  setMessage(getApiErrorMessage(error));
                },
              });
            }}
          >
            {isPending ? 'İşleniyor…' : 'Daveti kabul et'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
