import type { ReactElement } from 'react';
import { useState } from 'react';
import { Plug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { useErpConnections } from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';

import { AddConnectionDialog } from './AddConnectionDialog';
import { AddErpConnectionDialog } from './AddErpConnectionDialog';
import { ConnectionCard } from './ConnectionCard';
import { ErpConnectionCard } from './ErpConnectionCard';

export function ConnectionsPage(): ReactElement {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [addMarketplaceOpen, setAddMarketplaceOpen] = useState(false);
  const [addErpOpen, setAddErpOpen] = useState(false);

  const {
    data: connections,
    isLoading: mpLoading,
    isError: mpError,
    error: mpErr,
    refetch: refetchMp,
  } = useMarketplaceConnections();

  const {
    data: erpConnections,
    isLoading: erpLoading,
    isError: erpIsError,
    error: erpErr,
    refetch: refetchErp,
  } = useErpConnections();

  const openAddDialog = (): void => {
    if (activeTab === 'erp') {
      setAddErpOpen(true);
    } else {
      setAddMarketplaceOpen(true);
    }
  };

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
        <Button type="button" onClick={() => openAddDialog()}>
          Yeni Ekle
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="marketplace">Pazaryerleri</TabsTrigger>
          <TabsTrigger value="erp">ERP / Altyapı</TabsTrigger>
        </TabsList>
        <TabsContent value="marketplace" className="mt-6">
          {mpLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : null}

          {mpError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
              <p className="text-sm font-medium text-destructive">
                {getApiErrorMessage(mpErr)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void refetchMp();
                }}
              >
                Tekrar dene
              </Button>
            </div>
          ) : null}

          {!mpLoading && !mpError && (connections ?? []).length === 0 ? (
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
                onClick={() => {
                  setAddMarketplaceOpen(true);
                }}
              >
                İlk entegrasyonu ekle
              </Button>
            </div>
          ) : null}

          {!mpLoading && !mpError && (connections ?? []).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(connections ?? []).map((c) => (
                <ConnectionCard key={c.id} connection={c} />
              ))}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="erp" className="mt-6">
          {erpLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : null}

          {erpIsError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
              <p className="text-sm font-medium text-destructive">
                {getApiErrorMessage(erpErr)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void refetchErp();
                }}
              >
                Tekrar dene
              </Button>
            </div>
          ) : null}

          {!erpLoading && !erpIsError && (erpConnections ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Plug className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
              <h2 className="text-lg font-medium">Henüz ERP bağlantısı yok</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Muhasebe veya e-ticaret altyapınızı bağlayarak fatura ve stok
                akışını tek yerden yönetin.
              </p>
              <Button
                type="button"
                className="mt-6"
                onClick={() => {
                  setAddErpOpen(true);
                }}
              >
                İlk ERP bağlantısını ekle
              </Button>
            </div>
          ) : null}

          {!erpLoading && !erpIsError && (erpConnections ?? []).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(erpConnections ?? []).map((c) => (
                <ErpConnectionCard key={c.id} connection={c} />
              ))}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <AddConnectionDialog
        open={addMarketplaceOpen}
        onOpenChange={setAddMarketplaceOpen}
      />
      <AddErpConnectionDialog open={addErpOpen} onOpenChange={setAddErpOpen} />
    </div>
  );
}
