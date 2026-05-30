import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { formatIpAddress } from '@/lib/format-ip-address';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { validatePassword } from '@/lib/password-policy';
import { useAuthStore } from '@/store/auth.store';

import { useAuditLog } from './hooks/useAuditLog';
import { TwoFactorSettings } from './TwoFactorSettings';
import { AuditLogTable } from './tabs/AuditLogTable';
import { LoginHistoryDeviceIcon } from './tabs/login-history-device-icon';
import { LoginHistoryTable } from './tabs/LoginHistoryTable';
import {
  auditEntriesToLoginHistory,
  mergeLoginHistory,
  sessionsToLoginHistory,
} from './tabs/login-history.util';

const SECURITY_ACTION_PREFIXES = [
  'auth.',
  'security.',
  'partner.impersonation',
] as const;

interface SessionRow {
  id: string;
  device: string | null;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, FORM_MESSAGES.required),
    newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, FORM_MESSAGES.required),
  })
  .superRefine((data, ctx) => {
    const check = validatePassword(data.newPassword);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.errors[0] ?? 'Şifre politikasına uygun değil.',
        path: ['newPassword'],
      });
    }
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function isSecurityAuditAction(action: string): boolean {
  return SECURITY_ACTION_PREFIXES.some(
    (prefix) => action === prefix || action.startsWith(prefix),
  );
}

interface SecurityPageProps {
  /** @deprecated Ayarlar artık ayrı rota; yok sayılır */
  embedded?: boolean;
}

export function SecurityPage(_props: SecurityPageProps = {}): ReactElement {
  const { t } = useTranslation();
  const pageTitle = t('settings.tabs.security');
  usePageTitle(pageTitle);
  const queryClient = useQueryClient();
  const currentSessionId = useAuthStore((s) => s.sessionId);
  const authQuery = useAuth();

  const auditQuery = useAuditLog(50);
  const securityEvents = useMemo(
    () =>
      (auditQuery.data ?? [])
        .filter((e) => isSecurityAuditAction(e.action))
        .slice(0, 10),
    [auditQuery.data],
  );

  const orgSecurity = authQuery.data?.organization?.security;
  const requires2FASetup = orgSecurity?.requiresTwoFactorSetup === true;
  const passwordChangeRequired = orgSecurity?.passwordChangeRequired === true;
  const passwordChangeWarning = orgSecurity?.passwordChangeWarning === true;

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions', currentSessionId],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data } = await api.get<SessionRow[]>('/auth/sessions', {
        params:
          currentSessionId != null && currentSessionId.length > 0
            ? { currentSessionId }
            : undefined,
      });
      return data;
    },
  });

  const loginHistory = useMemo(() => {
    const fromAudit = auditEntriesToLoginHistory(auditQuery.data ?? []);
    const fromSessions = sessionsToLoginHistory(
      (sessionsQuery.data ?? []).map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        ipAddress: s.ipAddress,
        device: s.device,
        deviceType: s.deviceType,
      })),
    );
    return mergeLoginHistory(fromSessions, fromAudit, 10);
  }, [auditQuery.data, sessionsQuery.data]);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodFormResolver(passwordSchema),
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = passwordForm.watch('newPassword');

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Şifre güncellendi');
      passwordForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['audit-log'] });
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
      await api.delete('/auth/sessions', params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success(t('settings.security.revokeOthersSuccess'));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.delete('/auth/sessions');
    },
    onSuccess: () => {
      toast.success(t('settings.security.revokeAllSuccess'));
      useAuthStore.getState().logout();
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      await api.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success(t('settings.security.revokeSessionSuccess'));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const requestExport = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/users/export-data').then((r) => r.data),
    onSuccess: (data) => {
      toast.success(
        data.message ??
          'Talebiniz alındı. 30 dakika içinde e-posta ile gönderilecektir.',
      );
    },
    onError: () => {
      toast.error('Bir hata oluştu, lütfen tekrar deneyin.');
    },
  });

  const otherSessionCount = useMemo(() => {
    const rows = sessionsQuery.data ?? [];
    return rows.filter((s) => s.id !== currentSessionId).length;
  }, [sessionsQuery.data, currentSessionId]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('settings.security.pageSubtitle')}
        </p>
      </div>

      {requires2FASetup ? (
        <Alert variant="destructive">
          <AlertTitle>2FA zorunlu</AlertTitle>
          <AlertDescription>
            Organizasyonunuz iki adımlı doğrulamayı zorunlu kılıyor. Aşağıdan
            2FA kurulumunu tamamlayın.
          </AlertDescription>
        </Alert>
      ) : null}

      {passwordChangeRequired ? (
        <Alert variant="destructive">
          <AlertTitle>Şifre süresi doldu</AlertTitle>
          <AlertDescription>
            Şifreniz kurumsal politika gereği değiştirilmelidir. Lütfen yeni bir
            şifre belirleyin.
          </AlertDescription>
        </Alert>
      ) : null}

      {passwordChangeWarning && !passwordChangeRequired ? (
        <Alert>
          <AlertTitle>Şifre yenileme uyarısı</AlertTitle>
          <AlertDescription>
            Şifrenizin süresi yakında dolacak. Güvenliğiniz için yeni bir şifre
            belirlemenizi öneririz.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şifre değiştir</CardTitle>
          <CardDescription>
            Güçlü bir şifre seçin; tüm kurallar sağlandığında kaydedebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              className="max-w-md space-y-4"
              onSubmit={passwordForm.handleSubmit((values) => {
                changePassword.mutate({
                  currentPassword: values.currentPassword,
                  newPassword: values.newPassword,
                });
              })}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mevcut şifre</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yeni şifre</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <PasswordStrengthMeter password={newPasswordValue} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yeni şifre (tekrar)</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={
                  changePassword.isPending || !passwordForm.formState.isValid
                }
              >
                {changePassword.isPending ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <TwoFactorSettings />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('settings.security.sessionsTitle')}</CardTitle>
            <CardDescription>{t('settings.security.sessionsDescription')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                revokeAllOthersMutation.isPending || otherSessionCount === 0
              }
              onClick={() => revokeAllOthersMutation.mutate()}
            >
              {t('settings.security.revokeOthers')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={
                revokeAllSessionsMutation.isPending ||
                (sessionsQuery.data?.length ?? 0) === 0
              }
              onClick={() => revokeAllSessionsMutation.mutate()}
            >
              {t('settings.security.revokeAll')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : null}
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
            <div className="overflow-x-auto rounded-md border">
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
                          <span className="inline-flex items-center">
                            <LoginHistoryDeviceIcon deviceType={s.deviceType} />
                            {s.device ?? '—'}
                          </span>
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
                              {t('settings.security.revokeSession')}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.security.loginHistoryTitle')}</CardTitle>
          <CardDescription>{t('settings.security.loginHistoryDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditQuery.isLoading || sessionsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <LoginHistoryTable entries={loginHistory} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.security.auditLogTitle')}</CardTitle>
          <CardDescription>{t('settings.security.auditLogDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditQuery.isError ? (
            <QueryErrorAlert
              error={auditQuery.error}
              onRetry={() => {
                void auditQuery.refetch();
              }}
            />
          ) : null}
          {auditQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <AuditLogTable entries={securityEvents} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veri indirme (KVKK)</CardTitle>
          <CardDescription>
            KVKK madde 11 kapsamında kişisel verilerinize erişim ve taşınabilirlik hakkınız.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Tüm hesap verilerinizi paketleyip e-posta ile gönderebiliriz.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={requestExport.isPending}
            onClick={() => {
              requestExport.mutate();
            }}
          >
            {requestExport.isPending ? 'Gönderiliyor…' : 'Verilerimi indir'}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
