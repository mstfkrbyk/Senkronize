import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { WifiOff } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { loadOfflineQueue, loadOfflineSnapshot } from '@/lib/offline-cache';

function formatSavedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OfflinePage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('offline.pageTitle'));

  const snapshot = useMemo(() => loadOfflineSnapshot(), []);
  const queue = useMemo(() => loadOfflineQueue(), []);

  return (
    <main className="mx-auto min-h-[60vh] max-w-lg space-y-6 p-6">
      <PageHeader
        title={t('offline.title')}
        description={t('offline.description')}
        actions={
          <div
            className="flex size-12 items-center justify-center rounded-full bg-muted"
            aria-hidden
          >
            <WifiOff className="size-6 text-muted-foreground" />
          </div>
        }
      />
      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 pt-6">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('offline.retry')}
          </Button>

          {snapshot ? (
            <div
              className="rounded-lg border bg-muted/30 p-4 text-sm"
              aria-label={t('offline.snapshotAria')}
            >
              <p className="mb-2 font-medium text-foreground">
                {t('offline.snapshotTitle')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('offline.savedAt', { date: formatSavedAt(snapshot.savedAt) })}
              </p>
              <ul className="mt-3 space-y-1 text-foreground">
                {snapshot.ordersToday !== undefined ? (
                  <li>
                    {t('offline.ordersToday', { count: snapshot.ordersToday })}
                  </li>
                ) : null}
                {snapshot.revenueToday !== undefined ? (
                  <li>
                    {t('offline.revenueToday', {
                      amount: formatRevenue(snapshot.revenueToday),
                    })}
                  </li>
                ) : null}
                {snapshot.pendingOrders !== undefined ? (
                  <li>
                    {t('offline.pendingOrders', { count: snapshot.pendingOrders })}
                  </li>
                ) : null}
                {snapshot.lowStockCount !== undefined ? (
                  <li>
                    {t('offline.lowStockCount', { count: snapshot.lowStockCount })}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              {t('offline.noSnapshot')}
            </p>
          )}

          {queue.length > 0 ? (
            <p className="text-center text-muted-foreground text-sm" role="status">
              {t('offline.queuePending', { count: queue.length })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
