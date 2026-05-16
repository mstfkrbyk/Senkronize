import type { ReactElement } from 'react';
import { useState } from 'react';
import { Plug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api';
import { useMarketplaceConnections } from '@/hooks/useConnections';

import { AddConnectionDialog } from './AddConnectionDialog';
import { ConnectionCard } from './ConnectionCard';

export function ConnectionsPage(): ReactElement {
  const [addOpen, setAddOpen] = useState(false);
  const { data: connections, isLoading, isError, error, refetch } =
    useMarketplaceConnections();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Entegrasyonlar
          </h1>
          <p className="text-muted-foreground">
            Pazaryeri ve altyapı bağlantılarınızı yönetin.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          Yeni Ekle
        </Button>
      </div>

      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">Pazaryerleri</TabsTrigger>
          <TabsTrigger value="erp">ERP / Altyapı</TabsTrigger>
        </TabsList>
        <TabsContent value="marketplace" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
              <p className="text-sm font-medium text-destructive">
                {getApiErrorMessage(error)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void refetch();
                }}
              >
                Tekrar dene
              </Button>
            </div>
          ) : null}

          {!isLoading && !isError && (connections ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Plug className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
              <h2 className="text-lg font-medium">Henüz entegrasyon yok</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Pazaryeri hesaplarınızı bağlayarak sipariş ve stok
                senkronizasyonuna başlayın.
              </p>
              <Button
                type="button"
                className="mt-6"
                onClick={() => setAddOpen(true)}
              >
                İlk entegrasyonu ekle
              </Button>
            </div>
          ) : null}

          {!isLoading && !isError && (connections ?? []).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(connections ?? []).map((c) => (
                <ConnectionCard key={c.id} connection={c} />
              ))}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="erp" className="mt-6">
          <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
            ERP ve altyapı bağlantıları yakında burada olacak.
          </div>
        </TabsContent>
      </Tabs>

      <AddConnectionDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
