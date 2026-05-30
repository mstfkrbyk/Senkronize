import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { useErpConnections } from '@/hooks/useErpConnections';
import { getErpBranding } from '@/pages/connections/erp-display';
import { OrderAutoInvoiceSettingsCard } from '@/pages/settings/components/OrderAutoInvoiceSettingsCard';

export function ErpSyncSettingsTab(): ReactElement {
  const { t } = useTranslation();
  const { data: connections, isLoading, isError, error, refetch } = useErpConnections();
  const activeConnections = (connections ?? []).filter((c) => c.isActive);

  return (
    <SettingsPageShell
      title="ERP Senkronizasyon Ayarları"
      description="Harici ERP programınızla senkronizasyon davranışını yapılandırın."
    >
      <OrderAutoInvoiceSettingsCard showExternalLink />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Button asChild variant="default">
            <Link to="/connections?tab=erp">
              {t('settings.erpSyncOpenConnections')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.erpSyncConnectionsTitle')}</CardTitle>
          <CardDescription>{t('settings.erpSyncConnectionsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : null}
          {isError ? (
            <QueryErrorAlert
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : null}
          {!isLoading && !isError && activeConnections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.erpSyncEmpty')}</p>
          ) : null}
          {!isLoading && !isError
            ? activeConnections.map((connection) => {
                const branding = getErpBranding(connection.erpType);
                const label =
                  connection.accountLabel?.trim() ||
                  branding.label ||
                  connection.erpType;
                return (
                  <div
                    key={connection.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-primary">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.erpSyncLastSync', {
                          date: connection.lastSyncAt
                            ? new Date(connection.lastSyncAt).toLocaleString('tr-TR')
                            : t('settings.erpSyncNever'),
                        })}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/connections/erp/${connection.id}`}>
                        {t('settings.erpSyncConfigure')}
                      </Link>
                    </Button>
                  </div>
                );
              })
            : null}
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
