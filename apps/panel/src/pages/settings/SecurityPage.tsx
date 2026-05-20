import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { validatePassword } from '@/lib/password-policy';
import { useAuthStore } from '@/store/auth.store';

import { useAuditLog } from './hooks/useAuditLog';
import { TwoFactorSettings } from './TwoFactorSettings';
import { AuditLogTable } from './tabs/AuditLogTable';

const SECURITY_ACTION_PREFIXES = [
  'auth.',
  'security.',
  'partner.impersonation',
] as const;

interface SessionRow {
  id: string;
  device: string | null;
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

export function SecurityPage(): ReactElement {
  const queryClient = useQueryClient();
  const currentSessionId = useAuthStore((s) => s.sessionId);

  const auditQuery = useAuditLog(100);
  const securityEvents = useMemo(
    () => (auditQuery.data ?? []).filter((e) => isSecurityAuditAction(e.action)),
    [auditQuery.data],
  );

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

  const passwordForm = useForm<PasswordForm>({
    resolver: zodFormResolver(passwordSchema),
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
    <div className="space-y-6">
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
              <Button type="submit" disabled={changePassword.isPending}>
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
            <CardTitle className="text-base">Aktif oturumlar</CardTitle>
            <CardDescription>
              Cihaz, IP ve konum bilgisiyle oturumlarınızı yönetin.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={
              revokeAllOthersMutation.isPending || otherSessionCount === 0
            }
            onClick={() => revokeAllOthersMutation.mutate()}
          >
            Tüm Diğer Oturumları Sonlandır
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : null}
          {sessionsQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(sessionsQuery.error)}
            </p>
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
                        <TableCell className="font-mono text-sm">
                          {s.ipAddress ?? '—'}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son güvenlik olayları</CardTitle>
          <CardDescription>
            Giriş, şifre değişikliği, 2FA ve hesap erişimi kayıtları.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(auditQuery.error)}
            </p>
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
