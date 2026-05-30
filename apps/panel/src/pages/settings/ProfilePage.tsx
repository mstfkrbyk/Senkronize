import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Shield, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { useAuthStore } from '@/store/auth.store';

import { formatIpAddress } from '@/lib/format-ip-address';

import { resolveSettingsTabHref, resolveSettingsTabsLink } from './settings-tabs.config';


const profileSchema = z.object({
  name: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.'),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface SessionRow {
  id: string;
  device: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Yönetici',
    MANAGER: 'Müdür',
    VIEWER: 'İzleyici',
    SUPER_ADMIN: 'Sistem yöneticisi',
  };
  return map[role] ?? role;
}

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  const n = name.trim();
  if (n.length >= 2) {
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function ProfilePage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.profile'));
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError, error, refetch } = useAuth();
  const currentSessionId = useAuthStore((s) => s.sessionId);

  const profileForm = useForm<ProfileForm>({
    resolver: zodFormResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const sessionsQuery = useQuery({
    queryKey: ['users', 'sessions', currentSessionId],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data } = await api.get<SessionRow[]>('/users/sessions', {
        params:
          currentSessionId != null && currentSessionId.length > 0
            ? { currentSessionId }
            : undefined,
      });
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) => api.patch('/auth/profile', data),
    onSuccess: () => {
      toast.success('Profil güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const revokeAllOthersMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const params =
        currentSessionId != null && currentSessionId.length > 0
          ? { params: { exceptSessionId: currentSessionId } }
          : {};
      await api.delete('/users/sessions', params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'sessions'] });
      toast.success('Diğer oturumlar sonlandırıldı.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      await api.delete(`/users/sessions/${sessionId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'sessions'] });
      toast.success('Oturum sonlandırıldı.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  useEffect(() => {
    if (!me) {
      return;
    }
    profileForm.reset({ name: me.user.name });
  }, [me, profileForm]);

  const avatarInitials = useMemo(() => {
    if (!me) {
      return '??';
    }
    return initials(me.user.name, me.user.email);
  }, [me]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !me) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <QueryErrorAlert
              error={error ?? new Error('Profil yüklenemedi.')}
              onRetry={
                isError
                  ? () => {
                      void refetch();
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('settings.profileTab.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('settings.profileTab.subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarFallback className="bg-sky-100 text-lg font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-100">
            {avatarInitials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{me.user.name}</p>
          <p className="text-sm text-muted-foreground">{me.user.email}</p>
          <Badge variant="secondary">{roleLabel(me.user.role)}</Badge>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium text-primary">Profil bilgileri</h2>
        <Form {...profileForm}>
          <form
            className="grid gap-4"
            onSubmit={profileForm.handleSubmit((values) => {
              updateProfile.mutate({ name: values.name });
            })}
          >
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad soyad</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">E-posta</label>
              <Input value={me.user.email} readOnly />
            </div>
            <Button
              type="submit"
              disabled={
                updateProfile.isPending ||
                !profileForm.formState.isValid ||
                !profileForm.formState.isDirty
              }
            >
              {updateProfile.isPending ? 'Kaydediliyor…' : 'Profili kaydet'}
            </Button>
          </form>
        </Form>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium text-primary">
              <Shield className="h-5 w-5 text-sky-500" aria-hidden />
              İki adımlı doğrulama (2FA)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hesabınıza ek güvenlik katmanı ekleyin.
            </p>
          </div>
          <Button type="button" variant="outline" asChild>
            <Link to={resolveSettingsTabHref('security')}>
              {me.user.twoFactorEnabled ? '2FA ayarlarını yönet' : '2FA kurulumunu başlat'}
            </Link>
          </Button>
        </div>
        {me.user.twoFactorEnabled ? (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
            2FA etkin
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">2FA şu an kapalı.</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium text-primary">
              <Smartphone className="h-5 w-5" aria-hidden />
              Aktif oturumlar
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tanımadığınız cihazlardaki oturumları sonlandırın.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={
              revokeAllOthersMutation.isPending ||
              (sessionsQuery.data?.length ?? 0) <= 1
            }
            onClick={() => revokeAllOthersMutation.mutate()}
          >
            Tüm Diğer Oturumları Sonlandır
          </Button>
        </div>

        {sessionsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {sessionsQuery.isError ? (
          <QueryErrorAlert
            error={sessionsQuery.error}
            onRetry={() => {
              void sessionsQuery.refetch();
            }}
          />
        ) : null}

        {!sessionsQuery.isLoading && (sessionsQuery.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            Kayıtlı aktif oturum yok.
          </p>
        ) : null}

        {!sessionsQuery.isLoading && sessionsQuery.data?.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cihaz</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead>Son aktif</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsQuery.data.map((s) => {
                  const isCurrent =
                    s.isCurrent === true || currentSessionId === s.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {s.device ?? '—'}
                        {isCurrent ? (
                          <Badge className="ml-2" variant="default">
                            Bu cihaz
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatIpAddress(s.ipAddress)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.location ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(s.lastActiveAt).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isCurrent ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={revokeSessionMutation.isPending}
                            onClick={() => revokeSessionMutation.mutate(s.id)}
                          >
                            Bu Oturumu Sonlandır
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>

      <p className="text-sm text-muted-foreground">
        {t('settings.profileSettingsTabHint')}{' '}
        <Link
          to={resolveSettingsTabsLink('profile')}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('settings.profileSettingsTabLink')}
        </Link>
      </p>
    </div>
  );
}
