import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { api, getApiErrorMessage } from '@/lib/api';
import type {
  OrganizationSettings,
  PatchOrganizationSettings,
} from '@/types/organization-settings';

interface Props {
  /** Harici ERP sekmesinde bağlantı detayına yönlendirme göster */
  showExternalLink?: boolean;
}

export function OrderAutoInvoiceSettingsCard({
  showExternalLink = false,
}: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mode: accountingMode, isLoading: accountingModeLoading } = useAccountingMode();
  const [enabled, setEnabled] = useState(true);

  const settingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettings> => {
      const { data } = await api.get<OrganizationSettings>('/organizations/settings');
      return data;
    },
    enabled: accountingMode === 'NATIVE',
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (s) {
      setEnabled(s.defaultAutoInvoice ?? true);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (defaultAutoInvoice: boolean): Promise<OrganizationSettings> => {
      const payload: PatchOrganizationSettings = { defaultAutoInvoice };
      const { data } = await api.patch<OrganizationSettings>(
        '/organizations/settings',
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      setEnabled(data.defaultAutoInvoice ?? true);
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'settings'] });
      toast.success(t('settings.orderAutoInvoice.saved'));
    },
    onError: (err: Error) => {
      toast.error(getApiErrorMessage(err));
      const s = settingsQuery.data;
      if (s) {
        setEnabled(s.defaultAutoInvoice ?? true);
      }
    },
  });

  if (accountingModeLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (accountingMode === 'EXTERNAL_ERP') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.orderAutoInvoice.title')}</CardTitle>
          <CardDescription>{t('settings.orderAutoInvoice.externalErpHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 opacity-60">
            <div className="space-y-1">
              <p className="font-medium text-primary">{t('settings.orderAutoInvoice.label')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.orderAutoInvoice.externalErpDisabledHint')}
              </p>
            </div>
            <Switch checked={false} disabled aria-label={t('settings.orderAutoInvoice.label')} />
          </div>
          {showExternalLink ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/connections?tab=erp">{t('settings.orderAutoInvoice.openErpConnections')}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (settingsQuery.isError) {
    return (
      <QueryErrorAlert
        error={settingsQuery.error}
        onRetry={() => {
          void settingsQuery.refetch();
        }}
      />
    );
  }

  const serverValue = settingsQuery.data?.defaultAutoInvoice ?? true;
  const dirty = enabled !== serverValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.orderAutoInvoice.title')}</CardTitle>
        <CardDescription>{t('settings.orderAutoInvoice.nativeHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <p className="font-medium text-primary">{t('settings.orderAutoInvoice.label')}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.orderAutoInvoice.nativeDescription')}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={saveMutation.isPending}
            onCheckedChange={setEnabled}
            aria-label={t('settings.orderAutoInvoice.label')}
          />
        </div>
        {dirty ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(enabled)}
            >
              {saveMutation.isPending
                ? t('settings.orderAutoInvoice.saving')
                : t('settings.orderAutoInvoice.save')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
