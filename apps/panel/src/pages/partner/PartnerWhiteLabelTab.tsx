import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getApiErrorMessage, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { WhiteLabelSettingsDto } from '@/types/partner';

const schema = z.object({
  brandName: z.string().max(200).optional().or(z.literal('')),
  logoUrl: z.string().max(2000).optional().or(z.literal('')),
  primaryColor: z.string().max(32).optional().or(z.literal('')),
  supportEmail: z.string().max(320).optional().or(z.literal('')),
  supportPhone: z.string().max(40).optional().or(z.literal('')),
  customDomain: z.string().max(200).optional().or(z.literal('')),
  hideSenkronize: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function PartnerWhiteLabelTab(): ReactElement {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['partner', 'white-label'],
    queryFn: async (): Promise<WhiteLabelSettingsDto | null> => {
      const { data } = await api.get<WhiteLabelSettingsDto | null>('/partner/white-label');
      return data;
    },
    enabled: orgType === 'PARTNER',
  });

  const form = useForm<FormValues>({
    resolver: zodFormResolver(schema),
    defaultValues: {
      brandName: '',
      logoUrl: '',
      primaryColor: '#38bdf8',
      supportEmail: '',
      supportPhone: '',
      customDomain: '',
      hideSenkronize: false,
    },
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }
    form.reset({
      brandName: query.data.brandName ?? '',
      logoUrl: query.data.logoUrl ?? '',
      primaryColor: query.data.primaryColor ?? '#38bdf8',
      supportEmail: query.data.supportEmail ?? '',
      supportPhone: query.data.supportPhone ?? '',
      customDomain: query.data.customDomain ?? '',
      hideSenkronize: query.data.hideSenkronize,
    });
  }, [query.data, form]);

  const save = useMutation({
    mutationFn: async (values: FormValues): Promise<WhiteLabelSettingsDto> => {
      const { data } = await api.put<WhiteLabelSettingsDto>('/partner/white-label', {
        brandName: values.brandName?.trim() || undefined,
        logoUrl: values.logoUrl?.trim() || undefined,
        primaryColor: values.primaryColor?.trim() || undefined,
        supportEmail: values.supportEmail?.trim() || undefined,
        supportPhone: values.supportPhone?.trim() || undefined,
        customDomain: values.customDomain?.trim() || undefined,
        hideSenkronize: values.hideSenkronize,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Ayarlar kaydedildi.');
      void qc.invalidateQueries({ queryKey: ['partner', 'white-label'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const upload = useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<{ url: string }>('/images/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    },
    onSuccess: (url) => {
      form.setValue('logoUrl', url, { shouldValidate: true });
      toast.success('Logo yüklendi.');
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive">{getApiErrorMessage(query.error)}</p>
    );
  }

  const previewName = form.watch('brandName')?.trim() || 'Marka adınız';
  const previewLogo = form.watch('logoUrl')?.trim();
  const previewColor = form.watch('primaryColor')?.trim() || '#38bdf8';

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Beyaz etiket ayarları</CardTitle>
          <CardDescription>
            Müşteri arayüzünde gösterilecek marka bilgilerini yapılandırın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => save.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="brandName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marka adı</FormLabel>
                    <FormControl>
                      <Input placeholder="Ajansınız Entegrasyon" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Logo</FormLabel>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        upload.mutate(f);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem className="mt-2">
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormItem>
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ana renk</FormLabel>
                    <FormControl>
                      <Input
                        type="color"
                        className="h-10 w-32 max-w-full cursor-pointer p-1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supportEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destek e-postası</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="destek@ajans.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supportPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destek telefonu</FormLabel>
                    <FormControl>
                      <Input placeholder="+90 …" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hideSenkronize"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Senkronize markasını gizle</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Beyaz etiket deneyiminde platform adını göstermeyin
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={save.isPending || upload.isPending}>
                {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Önizleme</CardTitle>
          <CardDescription>Logo ve marka adının görünümü</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border bg-card p-6 shadow-inner"
            style={{ borderTopColor: previewColor, borderTopWidth: 4 }}
          >
            <div className="flex items-center gap-4">
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt=""
                  className="h-14 w-14 rounded-md border object-contain"
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: previewColor }}
                >
                  LOG
                </div>
              )}
              <div>
                <p className="text-lg font-semibold" style={{ color: previewColor }}>
                  {previewName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {form.watch('hideSenkronize') ? 'Powered by gizlendi' : 'Senkronize ile güçlendirildi'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
