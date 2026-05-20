import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
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
import { FORM_MESSAGES } from '@/lib/form-messages';

const profileSchema = z.object({
  name: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.'),
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
    resolver: zodFormResolver(profileSchema),
    defaultValues: { name: '' },
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

  useEffect(() => {
    if (!me) {
      return;
    }
    profileForm.reset({ name: me.user.name });
  }, [me, profileForm]);

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

      <p className="border-t pt-6 text-sm text-muted-foreground">
        Şifre ve oturum yönetimi için Ayarlar → Güvenlik sekmesini kullanın.
      </p>
    </div>
  );
}
