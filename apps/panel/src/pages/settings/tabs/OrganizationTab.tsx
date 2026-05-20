import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import type { OrganizationDetail } from '@/types/organization';

const BILLING_SEPARATOR = '\n---FATURA---\n';
const PHONE_PREFIX = '\nTel: ';

const orgSchema = z.object({
  name: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .min(2, 'Firma adı en az 2 karakter olmalıdır.'),
  taxNumber: z.string().max(20).optional().or(z.literal('')),
  taxOffice: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  logoUrl: z.string().max(2048).optional().or(z.literal('')),
  billingAddress: z.string().max(500).optional().or(z.literal('')),
  useSeparateBilling: z.boolean(),
  require2FA: z.boolean(),
});

type OrgFormValues = z.infer<typeof orgSchema>;

function parseStoredAddress(raw: string | null): {
  address: string;
  phone: string;
  billingAddress: string;
  useSeparateBilling: boolean;
} {
  if (!raw) {
    return { address: '', phone: '', billingAddress: '', useSeparateBilling: false };
  }

  let mainPart = raw;
  let billingAddress = '';
  if (raw.includes(BILLING_SEPARATOR)) {
    const [main, billing] = raw.split(BILLING_SEPARATOR);
    mainPart = main ?? '';
    billingAddress = billing?.trim() ?? '';
  }

  let phone = '';
  let address = mainPart;
  const phoneIndex = mainPart.lastIndexOf(PHONE_PREFIX);
  if (phoneIndex >= 0) {
    phone = mainPart.slice(phoneIndex + PHONE_PREFIX.length).trim();
    address = mainPart.slice(0, phoneIndex).trim();
  }

  return {
    address,
    phone,
    billingAddress,
    useSeparateBilling: billingAddress.length > 0,
  };
}

function serializeAddress(
  address: string,
  phone: string,
  billingAddress: string,
  useSeparateBilling: boolean,
): string | null {
  const trimmedAddress = address.trim();
  const trimmedPhone = phone.trim();
  const trimmedBilling = billingAddress.trim();

  let result = trimmedAddress;
  if (trimmedPhone.length > 0) {
    result = `${result}${PHONE_PREFIX}${trimmedPhone}`;
  }
  if (useSeparateBilling && trimmedBilling.length > 0) {
    result = `${result}${BILLING_SEPARATOR}${trimmedBilling}`;
  }

  return result.length > 0 ? result : null;
}

export function OrganizationTab(): ReactElement {
  const queryClient = useQueryClient();
  const [logoUploading, setLogoUploading] = useState(false);

  const orgQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async (): Promise<OrganizationDetail> => {
      const { data } = await api.get<OrganizationDetail>('/organizations/me');
      return data;
    },
  });

  const form = useForm<OrgFormValues>({
    resolver: zodFormResolver(orgSchema),
    defaultValues: {
      name: '',
      taxNumber: '',
      taxOffice: '',
      phone: '',
      address: '',
      city: '',
      logoUrl: '',
      billingAddress: '',
      useSeparateBilling: false,
      require2FA: false,
    },
  });

  useEffect(() => {
    if (!orgQuery.data) {
      return;
    }
    const parsed = parseStoredAddress(orgQuery.data.address);
    form.reset({
      name: orgQuery.data.name,
      taxNumber: orgQuery.data.taxNumber ?? '',
      taxOffice: orgQuery.data.taxOffice ?? '',
      phone: parsed.phone,
      address: parsed.address,
      city: orgQuery.data.city ?? '',
      logoUrl: orgQuery.data.logoUrl ?? '',
      billingAddress: parsed.billingAddress,
      useSeparateBilling: parsed.useSeparateBilling,
      require2FA: orgQuery.data.require2FA ?? false,
    });
  }, [orgQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: OrgFormValues): Promise<OrganizationDetail> => {
      const payload: Record<string, string | boolean | null | undefined> = {
        name: values.name,
        taxOffice: values.taxOffice?.trim() || undefined,
        city: values.city?.trim() || undefined,
        logoUrl: values.logoUrl?.trim() || undefined,
        require2FA: values.require2FA,
        address: serializeAddress(
          values.address ?? '',
          values.phone ?? '',
          values.billingAddress ?? '',
          values.useSeparateBilling,
        ),
      };
      const taxNumber = values.taxNumber?.trim();
      if (taxNumber) {
        payload.taxNumber = taxNumber;
      }
      const { data } = await api.patch<OrganizationDetail>('/organizations/me', payload);
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

  const handleLogoUpload = async (file: File): Promise<void> => {
    setLogoUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<{ url: string }>('/images/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      form.setValue('logoUrl', data.url, { shouldValidate: true });
      toast.success('Logo yüklendi.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLogoUploading(false);
    }
  };

  const useSeparateBilling = form.watch('useSeparateBilling');
  const logoUrl = form.watch('logoUrl');

  if (orgQuery.isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
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
          Organizasyon profilinizi, fatura bilgilerinizi ve güvenlik politikalarınızı yönetin.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="taxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vergi numarası</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxOffice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vergi dairesi</FormLabel>
                  <FormControl>
                    <Input placeholder="Kadıköy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon</FormLabel>
                <FormControl>
                  <Input placeholder="+90 212 000 00 00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adres</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Açık adres" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Şehir</FormLabel>
                <FormControl>
                  <Input placeholder="İstanbul" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3 rounded-lg border p-4">
            <FormLabel>Logo</FormLabel>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Firma logosu"
                className="h-16 w-auto rounded border bg-white object-contain p-1"
              />
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={logoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleLogoUpload(file);
                  }
                }}
              />
            </div>
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">veya logo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <FormLabel>Fatura için ayrı adres</FormLabel>
                <FormDescription>
                  Faturalarda farklı bir adres kullanmak istiyorsanız etkinleştirin.
                </FormDescription>
              </div>
              <FormField
                control={form.control}
                name="useSeparateBilling"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            {useSeparateBilling ? (
              <FormField
                control={form.control}
                name="billingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fatura adresi</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Fatura adresi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel htmlFor="require-2fa">2FA zorunluluğu</FormLabel>
              <FormDescription>
                Tüm kullanıcıların iki faktörlü doğrulamayı etkinleştirmesini zorunlu kılar.
              </FormDescription>
            </div>
            <FormField
              control={form.control}
              name="require2FA"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      id="require-2fa"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={saveMutation.isPending || logoUploading}>
            Kaydet
          </Button>
        </form>
      </Form>
    </div>
  );
}
