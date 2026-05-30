import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Loader2 } from 'lucide-react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
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
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage, api } from '@/lib/api';
import type { WhiteLabelSettingsDto } from '@/types/partner';

import { PartnerPageHeader } from './PartnerPageHeader';
import { usePartnerQueriesEnabled } from './hooks/usePartner';

const emptyOr = <T extends z.ZodType>(inner: T) =>
  z.union([z.literal(''), inner]);

function createWhiteLabelSchema(t: TFunction) {
  return z.object({
    brandName: z
      .string()
      .max(200, t('partner.pages.whiteLabel.validation.brandNameMax'))
      .optional()
      .or(z.literal('')),
    logoUrl: emptyOr(
      z
        .string()
        .url(t('partner.pages.whiteLabel.validation.logoUrlInvalid'))
        .max(2000),
    ),
    primaryColor: z.string().max(32).optional().or(z.literal('')),
    supportEmail: emptyOr(
      z
        .string()
        .email(t('partner.pages.whiteLabel.validation.supportEmailInvalid'))
        .max(320),
    ),
    supportPhone: z
      .string()
      .max(40, t('partner.pages.whiteLabel.validation.supportPhoneMax'))
      .optional()
      .or(z.literal('')),
    customDomain: z
      .string()
      .max(200, t('partner.pages.whiteLabel.validation.customDomainMax'))
      .optional()
      .or(z.literal('')),
    hideSenkronize: z.boolean(),
  });
}

type FormValues = z.infer<ReturnType<typeof createWhiteLabelSchema>>;

function toFormValues(data: WhiteLabelSettingsDto | null | undefined): FormValues {
  return {
    brandName: data?.brandName ?? '',
    logoUrl: data?.logoUrl ?? '',
    primaryColor: data?.primaryColor ?? '#38bdf8',
    supportEmail: data?.supportEmail ?? '',
    supportPhone: data?.supportPhone ?? '',
    customDomain: data?.customDomain ?? '',
    hideSenkronize: data?.hideSenkronize ?? false,
  };
}

export function PartnerWhiteLabelTab(): ReactElement {
  const { t } = useTranslation();
  const { isPending: authPending } = useAuth();
  const partnerQueriesEnabled = usePartnerQueriesEnabled();
  const qc = useQueryClient();
  const schema = useMemo(() => createWhiteLabelSchema(t), [t]);

  const query = useQuery({
    queryKey: ['partner', 'white-label'],
    queryFn: async (): Promise<WhiteLabelSettingsDto | null> => {
      const { data } = await api.get<WhiteLabelSettingsDto | null>('/partner/white-label');
      return data;
    },
    enabled: partnerQueriesEnabled,
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
    if (!query.isFetched) {
      return;
    }
    form.reset(toFormValues(query.data));
  }, [query.data, query.isFetched, form]);

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
    onSuccess: (saved) => {
      toast.success(t('partner.pages.whiteLabel.toast.saved'));
      form.clearErrors('root');
      qc.setQueryData(['partner', 'white-label'], saved);
      form.reset(toFormValues(saved));
    },
    onError: (e: unknown) => {
      const message = getApiErrorMessage(e);
      form.setError('root', { type: 'server', message });
      toast.error(message);
    },
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
      toast.success(t('partner.pages.whiteLabel.toast.logoUploaded'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const pageHeader = (
    <PartnerPageHeader
      title={t('partner.pages.whiteLabel.title')}
      description={t('partner.pages.whiteLabel.description')}
    />
  );

  if (authPending || (partnerQueriesEnabled && !query.isFetched)) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('partner.pages.whiteLabel.loading')}</p>
        </div>
      </div>
    );
  }

  if (!partnerQueriesEnabled) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <p className="text-sm text-muted-foreground">
          {t('partner.pages.whiteLabel.partnerOnly')}
        </p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={Palette}
          title={t('partner.pages.whiteLabel.errorTitle')}
          description={t('partner.pages.whiteLabel.errorDescription')}
          actionSlot={
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('partner.pages.whiteLabel.retry')}
            </Button>
          }
        />
        <QueryErrorAlert error={query.error} />
      </div>
    );
  }

  const previewName =
    form.watch('brandName')?.trim() || t('partner.pages.whiteLabel.previewBrandFallback');
  const previewLogo = form.watch('logoUrl')?.trim();
  const previewColor = form.watch('primaryColor')?.trim() || '#38bdf8';

  return (
    <div className="space-y-6">
      {pageHeader}
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('partner.pages.whiteLabel.brandSettingsTitle')}</CardTitle>
            <CardDescription>
              {t('partner.pages.whiteLabel.brandSettingsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => {
                  form.clearErrors('root');
                  save.mutate(v);
                })}
                className="space-y-4"
              >
                {form.formState.errors.root?.message ? (
                  <p className="text-sm text-destructive" role="alert">
                    {form.formState.errors.root.message}
                  </p>
                ) : null}
                <FormField
                  control={form.control}
                  name="brandName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('partner.pages.whiteLabel.brandName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('partner.pages.whiteLabel.brandNamePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>{t('partner.pages.whiteLabel.logo')}</FormLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="cursor-pointer"
                      disabled={upload.isPending}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          upload.mutate(f);
                        }
                        e.target.value = '';
                      }}
                    />
                    {upload.isPending ? (
                      <p className="text-xs text-muted-foreground">
                        {t('partner.pages.whiteLabel.logoUploading')}
                      </p>
                    ) : null}
                  </div>
                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem className="mt-2">
                        <FormLabel>{t('partner.pages.whiteLabel.logoUrl')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('partner.pages.whiteLabel.logoUrlPlaceholder')}
                            {...field}
                          />
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
                      <FormLabel>{t('partner.pages.whiteLabel.primaryColor')}</FormLabel>
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
                      <FormLabel>{t('partner.pages.whiteLabel.supportEmail')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('partner.pages.whiteLabel.supportEmailPlaceholder')}
                          {...field}
                        />
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
                      <FormLabel>{t('partner.pages.whiteLabel.supportPhone')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('partner.pages.whiteLabel.supportPhonePlaceholder')}
                          {...field}
                        />
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
                        <FormLabel>{t('partner.pages.whiteLabel.hideSenkronize')}</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t('partner.pages.whiteLabel.hideSenkronizeHint')}
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={save.isPending || upload.isPending}>
                  {save.isPending
                    ? t('partner.pages.whiteLabel.saving')
                    : t('partner.common.save')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('partner.pages.whiteLabel.previewTitle')}</CardTitle>
            <CardDescription>{t('partner.pages.whiteLabel.previewDescription')}</CardDescription>
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
                    alt={t('partner.pages.whiteLabel.previewLogoAlt')}
                    className="h-14 w-14 rounded-md border object-contain"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-md text-xs font-medium text-white"
                    style={{ backgroundColor: previewColor }}
                    aria-hidden
                  >
                    {t('partner.pages.whiteLabel.previewLogoInitials')}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold" style={{ color: previewColor }}>
                    {previewName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.watch('hideSenkronize')
                      ? t('partner.pages.whiteLabel.previewHidden')
                      : t('partner.pages.whiteLabel.previewPoweredBy')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
