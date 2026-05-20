import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export function OfflinePage(): ReactElement {
  usePageTitle('Çevrimdışı');

  const snapshot = useMemo(() => loadOfflineSnapshot(), []);
  const queue = useMemo(() => loadOfflineQueue(), []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 p-4">
      <div
        className="flex size-16 items-center justify-center rounded-full bg-muted"
        aria-hidden
      >
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>İnternet bağlantınız kesildi</CardTitle>
          <CardDescription>
            Bağlantı geri geldiğinde yeniden deneyin. Bekleyen işlemler bağlantı
            kurulunca senkronize edilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              window.location.reload();
            }}
          >
            Yeniden Dene
          </Button>

          {snapshot ? (
            <div
              className="rounded-lg border bg-muted/30 p-4 text-sm"
              aria-label="Son bilinen özet veriler"
            >
              <p className="mb-2 font-medium text-foreground">Son bilinen veriler</p>
              <p className="text-muted-foreground text-xs">
                Kayıt: {formatSavedAt(snapshot.savedAt)}
              </p>
              <ul className="mt-3 space-y-1 text-foreground">
                {snapshot.ordersToday !== undefined ? (
                  <li>Bugünkü sipariş: {snapshot.ordersToday}</li>
                ) : null}
                {snapshot.revenueToday !== undefined ? (
                  <li>
                    Bugünkü ciro:{' '}
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      maximumFractionDigits: 0,
                    }).format(snapshot.revenueToday)}
                  </li>
                ) : null}
                {snapshot.pendingOrders !== undefined ? (
                  <li>Bekleyen sipariş: {snapshot.pendingOrders}</li>
                ) : null}
                {snapshot.lowStockCount !== undefined ? (
                  <li>Düşük stok uyarısı: {snapshot.lowStockCount}</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              Henüz kayıtlı özet veri yok. Paneli çevrimiçi kullandıktan sonra burada
              görüntülenir.
            </p>
          )}

          {queue.length > 0 ? (
            <p className="text-center text-muted-foreground text-sm" role="status">
              {queue.length} bekleyen çevrimdışı işlem kuyrukta.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
