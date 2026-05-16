import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifre gerekli.'),
    newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, 'Şifre tekrarı gerekli.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Yönetici',
    MANAGER: 'Müdür',
    VIEWER: 'İzleyici',
  };
  return map[role] ?? role;
}

export function ProfileTab(): ReactElement {
  const { data: me, isLoading, isError, error } = useAuth();

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!me) {
      return;
    }
    form.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [me, form]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError || !me) {
    return (
      <p className="text-sm text-destructive">
        {getApiErrorMessage(error ?? new Error('Profil yüklenemedi.'))}
      </p>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">Profil bilgileri</h3>
        <p className="text-sm text-muted-foreground">
          Hesap bilgilerinizi görüntüleyin. Şifre değişimi yakında API ile bağlanacaktır.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Ad soyad</label>
          <Input value={me.user.name} readOnly />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">E-posta</label>
          <Input value={me.user.email} readOnly />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Rol</label>
          <Input value={roleLabel(me.user.role)} readOnly />
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h4 className="text-base font-medium text-primary">Şifre değiştir</h4>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(() => {
              toast.info('Şifre değişimi API üzerinden yakında etkinleşecek.');
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
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
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yeni şifre</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
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
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Şifreyi güncelle</Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
