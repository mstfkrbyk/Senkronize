import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
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
import { api, getApiErrorMessage } from '@/lib/api';
import type { OrganizationDetail } from '@/types/organization';

const orgSchema = z.object({
  name: z.string().min(2, 'Firma adı en az 2 karakter olmalıdır.'),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export function OrganizationTab(): ReactElement {
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async (): Promise<OrganizationDetail> => {
      const { data } = await api.get<OrganizationDetail>('/organizations/me');
      return data;
    },
  });

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (!orgQuery.data) {
      return;
    }
    form.reset({ name: orgQuery.data.name });
  }, [orgQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: OrgFormValues): Promise<OrganizationDetail> => {
      const { data } = await api.patch<OrganizationDetail>('/organizations/me', {
        name: values.name,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Firma bilgileri kaydedildi.');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  if (orgQuery.isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (orgQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {getApiErrorMessage(orgQuery.error)}
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">Firma bilgileri</h3>
        <p className="text-sm text-muted-foreground">
          Organizasyon adını güncelleyin. Logo ve iletişim alanları yakında.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            saveMutation.mutate(values);
          })}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Firma adı</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">İletişim e-postası</label>
              <Badge variant="secondary">Yakında</Badge>
            </div>
            <Input disabled placeholder="muhasebe@firma.com" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Telefon</label>
              <Badge variant="secondary">Yakında</Badge>
            </div>
            <Input disabled placeholder="+90 …" />
          </div>

          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Logo yükleme</span>{' '}
            <Badge variant="outline" className="ml-2">
              Yakında
            </Badge>
            <p className="mt-2">
              Kurumsal logonuzu panele yüklemek için depolama entegrasyonu tamamlanıyor.
            </p>
          </div>

          <Button type="submit" disabled={saveMutation.isPending}>
            Kaydet
          </Button>
        </form>
      </Form>
    </div>
  );
}
