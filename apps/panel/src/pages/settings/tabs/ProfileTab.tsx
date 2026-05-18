import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';

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

const profileSchema = z.object({
  name: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır.'),
});

type ProfileForm = z.infer<typeof profileSchema>;

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
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError, error } = useAuth();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
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

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Şifre güncellendi');
      passwordForm.reset();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  useEffect(() => {
    if (!me) {
      return;
    }
    profileForm.reset({ name: me.user.name });
    passwordForm.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [me, profileForm, passwordForm]);

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
    <div className="max-w-lg space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">Profil bilgileri</h3>
        <p className="text-sm text-muted-foreground">
          Hesap bilgilerinizi görüntüleyin ve güncelleyin.
        </p>
      </div>

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
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol</label>
            <Input value={roleLabel(me.user.role)} readOnly />
          </div>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Kaydediliyor…' : 'Profili kaydet'}
          </Button>
        </form>
      </Form>

      <div className="space-y-4 border-t pt-6">
        <h4 className="text-base font-medium text-primary">Şifre değiştir</h4>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit((values) => {
              changePassword.mutate({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              });
            })}
            className="space-y-4"
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
      </div>
    </div>
  );
}
