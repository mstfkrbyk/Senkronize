import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { cn } from '@/lib/utils';
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const orgQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async (): Promise<OrganizationDetail> => {
      const { data } = await api.get<OrganizationDetail>('/organizations/me');
      return data;
    },
  });

  const form = useForm<OrgFormValues>({
    resolver: zodFormResolver(orgSchema),
    mode: 'onChange',
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
      toast.success(t('settings.organizationTab.saveSuccess'));
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
      toast.success(t('settings.organizationTab.logoUploadSuccess'));
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
      <SettingsPageShell
        title={t('settings.organizationTab.title')}
        description="Organizasyon adı, vergi ve iletişim bilgilerini yönetin."
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </SettingsPageShell>
    );
  }

  if (orgQuery.isError) {
    return (
      <SettingsPageShell
        title={t('settings.organizationTab.title')}
        description="Organizasyon adı, vergi ve iletişim bilgilerini yönetin."
      >
        <QueryErrorAlert
          error={orgQuery.error}
          onRetry={() => {
            void orgQuery.refetch();
          }}
        />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      title={t('settings.organizationTab.title')}
      description="Organizasyon adı, vergi ve iletişim bilgilerini yönetin."
    >
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="pt-6">
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
                <FormLabel>{t('settings.organizationTab.nameLabel')}</FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
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
                  <FormLabel>{t('settings.organizationTab.taxNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input className="bg-background" placeholder="1234567890" {...field} />
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
                  <FormLabel>{t('settings.organizationTab.taxOfficeLabel')}</FormLabel>
                  <FormControl>
                    <Input className="bg-background" placeholder="Kadıköy" {...field} />
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
                <FormLabel>{t('settings.organizationTab.phoneLabel')}</FormLabel>
                <FormControl>
                  <Input className="bg-background" placeholder="+90 212 000 00 00" {...field} />
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
                <FormLabel>{t('settings.organizationTab.addressLabel')}</FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-background"
                    rows={3}
                    placeholder="Açık adres"
                    {...field}
                  />
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
                <FormLabel>{t('settings.organizationTab.cityLabel')}</FormLabel>
                <FormControl>
                  <Input className="bg-background" placeholder="İstanbul" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <Label className="text-sm font-medium leading-none">
              {t('settings.organizationTab.logoLabel')}
            </Label>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Firma logosu"
                className="h-16 w-auto rounded border bg-white object-contain p-1"
              />
            ) : null}
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              disabled={logoUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleLogoUpload(file);
                }
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label={t('settings.organizationTab.logoUploadButton')}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                logoDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
                logoUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer',
              )}
              onClick={() => logoFileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  logoFileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setLogoDragActive(true);
              }}
              onDragLeave={() => setLogoDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setLogoDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  void handleLogoUpload(file);
                }
              }}
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {t('settings.organizationTab.logoDropHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  logoFileInputRef.current?.click();
                }}
              >
                {logoUploading
                  ? t('settings.organizationTab.saving')
                  : t('settings.organizationTab.logoUploadButton')}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    {t('settings.organizationTab.logoUrlLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input className="bg-background" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-sm font-medium leading-none">
                  {t('settings.organizationTab.separateBillingLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.organizationTab.separateBillingHint')}
                </p>
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
                    <FormLabel>{t('settings.organizationTab.billingAddressLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="bg-background"
                        rows={3}
                        placeholder="Fatura adresi"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-2fa" className="text-sm font-medium leading-none">
                {t('settings.organizationTab.require2faLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.organizationTab.require2faHint')}
              </p>
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

            <Button
              type="submit"
              disabled={
                saveMutation.isPending || logoUploading || !form.formState.isValid
              }
            >
              {saveMutation.isPending
                ? t('settings.organizationTab.saving')
                : t('settings.organizationTab.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </SettingsPageShell>
  );
}
