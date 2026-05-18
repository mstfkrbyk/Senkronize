import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Plug } from 'lucide-react';

import {
  ConnectionFormModal,
  type ConnectionFormModalConfig,
} from '@/components/ConnectionFormModal';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { useErpConnections, type ErpConnectionDto } from '@/hooks/useErpConnections';
import { ECOMMERCE_MARKETPLACE_IDS } from '@/lib/connection-form-fields';
import { getApiErrorMessage } from '@/lib/api';
import type { MarketplaceConnectionDto } from '@/types/connection';

import { ConnectionCard } from './ConnectionCard';
import { ErpConnectionCard } from './ErpConnectionCard';

const ECOMMERCE_SET = new Set<string>(ECOMMERCE_MARKETPLACE_IDS);

export function ConnectionsPage(): ReactElement {
  const [mainTab, setMainTab] = useState<'marketplace' | 'ecommerce' | 'erp'>('marketplace');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ConnectionFormModalConfig | null>(null);

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

  const marketplaceOnly = useMemo((): MarketplaceConnectionDto[] => {
    return (connections ?? []).filter((c) => !ECOMMERCE_SET.has(c.platform));
  }, [connections]);

  const ecommerceOnly = useMemo((): MarketplaceConnectionDto[] => {
    return (connections ?? []).filter((c) => ECOMMERCE_SET.has(c.platform));
  }, [connections]);

  const openAddModal = (): void => {
    if (mainTab === 'erp') {
      setModalConfig({ kind: 'erp', mode: 'create' });
    } else if (mainTab === 'ecommerce') {
      setModalConfig({
        kind: 'marketplace',
        mode: 'create',
        listFilter: 'ecommerce',
      });
    } else {
      setModalConfig({
        kind: 'marketplace',
        mode: 'create',
        listFilter: 'marketplace',
      });
    }
    setModalOpen(true);
  };

  const openEditMarketplace = (c: MarketplaceConnectionDto): void => {
    setModalConfig({ kind: 'marketplace', mode: 'edit', connection: c });
    setModalOpen(true);
  };

  const openEditErp = (c: ErpConnectionDto): void => {
    setModalConfig({ kind: 'erp', mode: 'edit', connection: c });
    setModalOpen(true);
  };

  const handleModalOpenChange = (next: boolean): void => {
    setModalOpen(next);
    if (!next) {
      setModalConfig(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Bağlantılar
          </h1>
          <p className="text-muted-foreground">
            Pazaryeri, e-ticaret siteniz ve ERP entegrasyonlarınızı yönetin.
          </p>
        </div>
        <Button type="button" onClick={() => openAddModal()}>
          Bağlantı Ekle
        </Button>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="marketplace">Pazaryerleri</TabsTrigger>
          <TabsTrigger value="ecommerce">E-Ticaret</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
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

          {!mpLoading && !mpError && marketplaceOnly.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="Bağlantı yok"
              description="Pazaryeri hesaplarınızı bağlayarak sipariş ve stok senkronizasyonuna başlayın."
              action={{
                label: 'İlk bağlantınızı ekleyin',
                onClick: () => {
                  setMainTab('marketplace');
                  setModalConfig({
                    kind: 'marketplace',
                    mode: 'create',
                    listFilter: 'marketplace',
                  });
                  setModalOpen(true);
                },
              }}
            />
          ) : null}

          {!mpLoading && !mpError && marketplaceOnly.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {marketplaceOnly.map((c) => (
                <ConnectionCard key={c.id} connection={c} onEditPress={openEditMarketplace} />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="ecommerce" className="mt-6">
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

          {!mpLoading && !mpError && ecommerceOnly.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="E-ticaret bağlantısı yok"
              description="T-Soft, Ticimax, WooCommerce, Shopify veya İdeasoft mağazanızı bağlayın."
              action={{
                label: 'Mağaza bağlantısı ekle',
                onClick: () => {
                  setModalConfig({
                    kind: 'marketplace',
                    mode: 'create',
                    listFilter: 'ecommerce',
                  });
                  setModalOpen(true);
                },
              }}
            />
          ) : null}

          {!mpLoading && !mpError && ecommerceOnly.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {ecommerceOnly.map((c) => (
                <ConnectionCard key={c.id} connection={c} onEditPress={openEditMarketplace} />
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
            <EmptyState
              icon={Plug}
              title="ERP bağlantısı yok"
              description="Muhasebe veya stok sisteminizi bağlayarak fatura ve stok akışını tek yerden yönetin."
              action={{
                label: 'ERP bağlantısı ekle',
                onClick: () => {
                  setModalConfig({ kind: 'erp', mode: 'create' });
                  setModalOpen(true);
                },
              }}
            />
          ) : null}

          {!erpLoading && !erpIsError && (erpConnections ?? []).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(erpConnections ?? []).map((c) => (
                <ErpConnectionCard key={c.id} connection={c} onEditPress={openEditErp} />
              ))}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <ConnectionFormModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        config={modalConfig}
      />
    </div>
  );
}
