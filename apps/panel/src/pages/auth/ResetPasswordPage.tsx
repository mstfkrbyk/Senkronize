import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { useAuthStore } from '@/store/auth.store';
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
import { PasswordInput } from '@/components/ui/password-input';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, FORM_MESSAGES.required),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authToken = useAuthStore((s) => s.token);
  const token = searchParams.get('token')?.trim() ?? '';
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodFormResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const resetMutation = useMutation({
    mutationFn: async (values: ResetPasswordFormValues): Promise<{ ok: true }> => {
      const { data } = await api.post<{ ok: true }>('/auth/reset-password', {
        token,
        newPassword: values.newPassword,
      });
      return data;
    },
    onMutate: () => {
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  useEffect(() => {
    document.title = 'Şifre sıfırla — Senkronize';
  }, []);

  if (authToken) {
    return <Navigate to="/" replace />;
  }

  if (!token) {
    return (
      <Card className="mx-auto w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader>
          <CardTitle>Şifre sıfırlama</CardTitle>
          <CardDescription>
            Geçersiz veya eksik bağlantı. Lütfen e-postanızdaki sıfırlama bağlantısını
            kullanın veya yeni bir talep oluşturun.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full" variant="default">
            <Link to="/forgot-password">Yeni sıfırlama talebi</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Giriş sayfasına dön
            </Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>Yeni şifre belirle</CardTitle>
        <CardDescription>
          Hesabınız için yeni bir şifre girin (en az 8 karakter).
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => resetMutation.mutate(values))}
        >
          <CardContent className="space-y-4">
            {resetMutation.isSuccess ? (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertDescription>
                  Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
                </AlertDescription>
              </Alert>
            ) : null}
            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            {!resetMutation.isSuccess ? (
              <>
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yeni şifre</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="text-base"
                          {...field}
                          onChange={(e) => {
                            setFormError(null);
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yeni şifre (tekrar)</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="text-base"
                          {...field}
                          onChange={(e) => {
                            setFormError(null);
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {resetMutation.isSuccess ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate('/login', { replace: true })}
              >
                Giriş sayfasına git
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-full"
                disabled={resetMutation.isPending || !form.formState.isValid}
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Kaydediliyor…
                  </>
                ) : (
                  'Şifreyi güncelle'
                )}
              </Button>
            )}
            {!resetMutation.isSuccess ? (
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to="/forgot-password"
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  Yeni sıfırlama talebi
                </Link>
              </p>
            ) : null}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
