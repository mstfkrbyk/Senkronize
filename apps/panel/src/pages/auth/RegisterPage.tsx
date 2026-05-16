import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { getApiErrorMessage, api } from '@/lib/api';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Ad en az 2 karakter olmalıdır.'),
    email: z.string().email('Geçerli bir e-posta girin.'),
    password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, 'Şifre tekrarı gerekli.'),
    acceptTos: z.boolean().refine((v) => v === true, {
      message: 'Kullanım şartlarını kabul etmelisiniz.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTos: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues): Promise<void> => {
      const { data: tokens } = await api.post<TokenPair>('/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password,
        companyName: values.name,
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
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
        onboardingCompleted: me.organization.onboardingCompleted,
        plan: me.organization.plan,
      });
    },
    onSuccess: () => {
      toast.success('Kayıt tamamlandı, hoş geldiniz.');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  useEffect(() => {
    document.title = 'Kayıt — Senkronize';
  }, []);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hesap oluştur</CardTitle>
        <CardDescription>
          Şirketiniz için 14 günlük denemeyi birkaç adımda başlatın.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) =>
            registerMutation.mutate(values),
          )}
        >
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Soyad</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Adınız Soyadınız" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      placeholder="ornek@sirket.com"
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
                  <FormLabel>Şifre</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="En az 8 karakter"
                      {...field}
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
                  <FormLabel>Şifre tekrar</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Şifrenizi tekrar girin"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acceptTos"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal">
                      Senkronize kullanım şartlarını ve gizlilik politikasını
                      okudum, kabul ediyorum.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Kaydediliyor…' : 'Kayıt ol'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Zaten hesabınız var mı?{' '}
              <Link
                to="/login"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Giriş yapın
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
