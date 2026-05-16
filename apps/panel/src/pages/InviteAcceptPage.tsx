import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useAuthStore } from '@/store/auth.store';

import { useAcceptPartnerInvite } from '@/pages/partner/hooks/usePartner';

export function InviteAcceptPage(): ReactElement {
  const { token: urlToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const jwt = useAuthStore((s) => s.token);
  const accept = useAcceptPartnerInvite();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!urlToken) {
      setMessage('Geçersiz davet bağlantısı.');
      return;
    }
    if (!jwt) {
      return;
    }

    const storageKey = `senkronize-invite-attempt:${urlToken}`;
    if (sessionStorage.getItem(storageKey)) {
      return;
    }
    sessionStorage.setItem(storageKey, '1');

    accept.mutate(urlToken, {
      onSuccess: () => {
        navigate('/dashboard', { replace: true });
      },
      onError: (error: unknown) => {
        sessionStorage.removeItem(storageKey);
        setMessage(getApiErrorMessage(error));
      },
    });
  }, [urlToken, jwt, accept, navigate]);

  if (!urlToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Davet</CardTitle>
            <CardDescription>Geçersiz davet bağlantısı.</CardDescription>
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
              <a href={loginHref}>Giriş yap</a>
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <a href={`/register?inviteToken=${encodeURIComponent(urlToken)}`}>
                Kayıt ol
              </a>
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
          <CardDescription>Davetiniz işleniyor…</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
        </CardContent>
      </Card>
    </div>
  );
}
