import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { useAcceptPartnerInvite } from '@/pages/partner/hooks/usePartner';
import { useAuthStore } from '@/store/auth.store';

export function InviteAcceptPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('partnerInviteAccept.pageTitle'));

  const { token: urlToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const jwt = useAuthStore((s) => s.token);
  const { mutate, isPending } = useAcceptPartnerInvite();
  const [message, setMessage] = useState<string | null>(null);

  if (!urlToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('partnerInviteAccept.inviteTitle')}</CardTitle>
            <CardDescription>{t('partnerInviteAccept.invalidLink')}</CardDescription>
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
            <CardTitle>{t('partnerInviteAccept.partnerTitle')}</CardTitle>
            <CardDescription>{t('partnerInviteAccept.loginRequired')}</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" asChild>
              <Link to={loginHref}>{t('partnerInviteAccept.signIn')}</Link>
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <Link to={`/register?inviteToken=${encodeURIComponent(urlToken)}`}>
                {t('partnerInviteAccept.register')}
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
            <CardTitle>{t('partnerInviteAccept.failedTitle')}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              {t('partnerInviteAccept.backToPanel')}
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
          <CardTitle>{t('partnerInviteAccept.partnerTitle')}</CardTitle>
          <CardDescription>{t('partnerInviteAccept.confirmDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-4">
          {isPending ? (
            <Loader2
              className="size-8 animate-spin text-muted-foreground"
              aria-label={t('partnerInviteAccept.loadingAria')}
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
            {isPending ? t('partnerInviteAccept.processing') : t('partnerInviteAccept.accept')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
