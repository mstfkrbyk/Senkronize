import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';

import { getApiErrorMessage, api } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse, TokenPair } from '@/types/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface InvitePreview {
  organizationName: string;
  email: string;
  expiresAt: string;
}

export function AcceptInvitePage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('acceptInvite.pageTitle'));

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, FORM_MESSAGES.required).max(100),
        password: z.string().min(8, t('acceptInvite.passwordMin')),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodFormResolver(schema),
    defaultValues: { name: '', password: '' },
  });

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      setPreviewLoading(true);
      try {
        const { data } = await api.get<InvitePreview>('/auth/invite-preview', {
          params: { token },
        });
        if (!cancelled) {
          setPreview(data);
          setPreviewError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptMutation = useMutation({
    mutationFn: async (values: FormValues): Promise<TokenPair> => {
      const { data } = await api.post<TokenPair>(
        '/auth/accept-invite',
        { name: values.name, password: values.password },
        { params: { token } },
      );
      return data;
    },
    onSuccess: async (tokens) => {
      setTokens(tokens.accessToken, tokens.refreshToken, tokens.sessionId);
      const { data: me } = await api.get<MeResponse>('/auth/me');
      queryClient.setQueryData(['auth', 'me'], me);
      setUser({
        id: me.user.id,
        email: me.user.email,
        name: me.user.name,
        role: me.user.role,
      });
      setOrg({
        id: me.organization.id,
        name: me.organization.name,
        slug: me.organization.slug,
        type: me.organization.type,
        onboardingCompleted: me.organization.onboardingCompleted,
        plan: me.organization.plan,
        orgProducts: me.organization.orgProducts,
        accountingMode: me.organization.accountingMode,
      });
      toast.success(t('acceptInvite.successToast'));
      navigate('/dashboard', { replace: true });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (!token) {
    return (
      <div className="flex w-full justify-center">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('acceptInvite.inviteTitle')}</CardTitle>
            <CardDescription>{t('acceptInvite.invalidLink')}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link to="/login">{t('acceptInvite.backToLogin')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (previewLoading) {
    return (
      <div className="flex w-full justify-center">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('acceptInvite.inviteTitle')}</CardTitle>
            <CardDescription>{t('acceptInvite.verifying')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="flex w-full justify-center">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('acceptInvite.unavailableTitle')}</CardTitle>
            <CardDescription>
              {previewError ?? t('acceptInvite.notFound')}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link to="/login">{t('acceptInvite.backToLogin')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('acceptInvite.joinTitle')}</CardTitle>
          <CardDescription className="space-y-1">
            <span>
              <strong>{preview.organizationName}</strong> {t('acceptInvite.invitedBySuffix')}
            </span>
            <span>{t('acceptInvite.completeAccount', { email: preview.email })}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                acceptMutation.mutate(values);
              })}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('acceptInvite.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={t('acceptInvite.namePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('acceptInvite.passwordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={acceptMutation.isPending}>
                {t('acceptInvite.submit')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <Button asChild variant="link">
            <Link to="/login">{t('acceptInvite.alreadyHaveAccount')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
