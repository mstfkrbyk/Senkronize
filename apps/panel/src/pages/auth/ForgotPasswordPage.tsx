import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .email(FORM_MESSAGES.email),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage(): ReactElement {
  const token = useAuthStore((s) => s.token);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodFormResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const forgotMutation = useMutation({
    mutationFn: async (values: ForgotPasswordFormValues): Promise<{ ok: true }> => {
      const { data } = await api.post<{ ok: true }>('/auth/forgot-password', {
        email: values.email,
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
    document.title = 'Şifremi unuttum — Senkronize';
  }, []);

  if (token) {
    return <Navigate to="/" replace />;
  }

  return (
    <Card className="mx-auto w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>Şifremi unuttum</CardTitle>
        <CardDescription>
          Kayıtlı e-posta adresinize şifre sıfırlama bağlantısı göndereceğiz.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => forgotMutation.mutate(values))}
        >
          <CardContent className="space-y-4">
            {forgotMutation.isSuccess ? (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertDescription>
                  E-postanızı kontrol edin. Şifre sıfırlama bağlantısı gönderildi.
                </AlertDescription>
              </Alert>
            ) : null}
            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            {!forgotMutation.isSuccess ? (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="ornek@sirket.com"
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
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {!forgotMutation.isSuccess ? (
              <Button
                type="submit"
                className="w-full"
                disabled={forgotMutation.isPending || !form.formState.isValid}
              >
                {forgotMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Gönderiliyor…
                  </>
                ) : (
                  'Sıfırlama bağlantısı gönder'
                )}
              </Button>
            ) : null}
            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Giriş sayfasına dön
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
