import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { OrderAutoInvoiceSettingsCard } from '@/pages/settings/components/OrderAutoInvoiceSettingsCard';
import {
  formatInvoiceNumberPreview,
  INVOICE_NUMBER_PREFIX_MAX_LENGTH,
  isInvoiceNumberPrefixValid,
  type OrganizationSettings,
  type PatchOrganizationSettings,
} from '@/types/organization-settings';

export function InvoiceNumberingTab(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [prefix, setPrefix] = useState('');
  const [nextSequence, setNextSequence] = useState('1');

  const settingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettings> => {
      const { data } = await api.get<OrganizationSettings>('/organizations/settings');
      return data;
    },
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) {
      return;
    }
    setPrefix(
      (s.invoiceNumberPrefix ?? '')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, INVOICE_NUMBER_PREFIX_MAX_LENGTH),
    );
    setNextSequence(String(s.nextSequence ?? 1));
  }, [settingsQuery.data]);

  const prefixValid = useMemo(() => isInvoiceNumberPrefixValid(prefix), [prefix]);

  const parsedSequence = useMemo(() => {
    const n = Number(nextSequence.trim());
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [nextSequence]);

  const preview = useMemo(() => {
    if (parsedSequence === null || !prefixValid) {
      return t('settings.invoiceNumberingFormatExample', { year });
    }
    return formatInvoiceNumberPreview(prefix, year, parsedSequence);
  }, [parsedSequence, prefix, prefixValid, year, t]);

  const dirty = useMemo(() => {
    const s = settingsQuery.data;
    if (!s || parsedSequence === null || !prefixValid) {
      return false;
    }
    return (
      (s.invoiceNumberPrefix ?? '') !== prefix.trim() ||
      s.nextSequence !== parsedSequence
    );
  }, [settingsQuery.data, prefix, parsedSequence, prefixValid]);

  const canSave = dirty && prefixValid && parsedSequence !== null;

  const saveMutation = useMutation({
    mutationFn: async (): Promise<OrganizationSettings> => {
      if (!prefixValid) {
        throw new Error(t('settings.invoiceNumberingPrefixInvalid'));
      }
      if (parsedSequence === null) {
        throw new Error(t('settings.invoiceNumberingSequenceInvalid'));
      }
      const payload: PatchOrganizationSettings = {
        invoiceNumberPrefix: prefix.trim(),
        nextSequence: parsedSequence,
      };
      const { data } = await api.patch<OrganizationSettings>(
        '/organizations/settings',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'settings'] });
      toast.success(t('settings.invoiceNumberingSaved'));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : getApiErrorMessage(err));
    },
  });

  if (settingsQuery.isLoading) {
    return (
      <SettingsPageShell
        title="Fatura Numaralama"
        description="Fatura seri numarası ve başlangıç değerini özelleştirin."
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </SettingsPageShell>
    );
  }

  if (settingsQuery.isError) {
    return (
      <SettingsPageShell
        title="Fatura Numaralama"
        description="Fatura seri numarası ve başlangıç değerini özelleştirin."
      >
        <QueryErrorAlert
          error={settingsQuery.error}
          onRetry={() => {
            void settingsQuery.refetch();
          }}
        />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      title="Fatura Numaralama"
      description="Fatura seri numarası ve başlangıç değerini özelleştirin."
    >
      <OrderAutoInvoiceSettingsCard />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="invoice-prefix">{t('settings.invoiceNumberingPrefixLabel')}</Label>
            <Input
              id="invoice-prefix"
              value={prefix}
              onChange={(e) => {
                const next = e.target.value
                  .replace(/[^A-Za-z0-9]/g, '')
                  .slice(0, INVOICE_NUMBER_PREFIX_MAX_LENGTH);
                setPrefix(next);
              }}
              placeholder={t('settings.invoiceNumberingPrefixPlaceholder')}
              maxLength={INVOICE_NUMBER_PREFIX_MAX_LENGTH}
              autoComplete="off"
              aria-invalid={!prefixValid}
            />
            {!prefixValid ? (
              <p className="text-xs text-destructive">
                {t('settings.invoiceNumberingPrefixInvalid')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('settings.invoiceNumberingPrefixHint')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-sequence">{t('settings.invoiceNumberingSequenceLabel')}</Label>
            <Input
              id="invoice-sequence"
              type="number"
              min={1}
              max={9999999}
              value={nextSequence}
              onChange={(e) => setNextSequence(e.target.value)}
              aria-invalid={parsedSequence === null}
            />
            {parsedSequence === null ? (
              <p className="text-xs text-destructive">
                {t('settings.invoiceNumberingSequenceInvalid')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('settings.invoiceNumberingSequenceHint')}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium text-primary">
              {t('settings.invoiceNumberingFormatLabel')}
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{preview}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('settings.invoiceNumberingAutoNote')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('settings.invoiceNumberingOverdueCronNote')}
          </p>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? t('settings.invoiceNumberingSaving')
                : t('settings.invoiceNumberingSave')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
