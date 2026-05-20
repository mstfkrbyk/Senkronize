import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useErpConnections } from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import { getErpBranding } from '@/pages/connections/erp-display';

export function ErpSyncSettingsTab(): ReactElement {
  const { t } = useTranslation();
  const { data: connections, isLoading, isError, error } = useErpConnections();
  const activeConnections = (connections ?? []).filter((c) => c.isActive);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" aria-hidden />
            {t('settings.erpSyncTitle')}
          </CardTitle>
          <CardDescription>{t('settings.erpSyncHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
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
    </div>
  );
}
