import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { ErpSetupWizard } from './ErpSetupWizard';

const ECOMMERCE_SET = new Set<string>(ECOMMERCE_MARKETPLACE_IDS);

export function ConnectionsPage(): ReactElement {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<'marketplace' | 'ecommerce' | 'erp'>('marketplace');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ConnectionFormModalConfig | null>(null);
  const [erpWizardOpen, setErpWizardOpen] = useState(false);

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
            {t('connections.title')}
          </h1>
          <p className="text-muted-foreground">{t('connections.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mainTab === 'erp' ? (
            <Button type="button" variant="outline" onClick={() => setErpWizardOpen(true)}>
              ERP Kurulum Sihirbazı
            </Button>
          ) : null}
          <Button type="button" onClick={() => openAddModal()}>
            {t('connections.add')}
          </Button>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="marketplace">{t('connections.marketplace')}</TabsTrigger>
          <TabsTrigger value="ecommerce">{t('connections.ecommerce')}</TabsTrigger>
          <TabsTrigger value="erp">{t('connections.erp')}</TabsTrigger>
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
                {t('common.retry')}
              </Button>
            </div>
          ) : null}

          {!mpLoading && !mpError && marketplaceOnly.length === 0 ? (
            <EmptyState
              icon={Plug}
              title={t('connections.emptyMarketplaceTitle')}
              description={t('connections.emptyMarketplaceDescription')}
              action={{
                label: t('connections.emptyMarketplaceAction'),
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
                {t('common.retry')}
              </Button>
            </div>
          ) : null}

          {!mpLoading && !mpError && ecommerceOnly.length === 0 ? (
            <EmptyState
              icon={Plug}
              title={t('connections.emptyEcommerceTitle')}
              description={t('connections.emptyEcommerceDescription')}
              action={{
                label: t('connections.emptyEcommerceAction'),
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
                {t('common.retry')}
              </Button>
            </div>
          ) : null}

          {!erpLoading && !erpIsError && (erpConnections ?? []).length === 0 ? (
            <EmptyState
              icon={Plug}
              title={t('connections.emptyErpTitle')}
              description={t('connections.emptyErpDescription')}
              action={{
                label: t('connections.emptyErpAction'),
                onClick: () => {
                  setErpWizardOpen(true);
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

      <ErpSetupWizard
        open={erpWizardOpen}
        onOpenChange={setErpWizardOpen}
        onCompleted={() => {
          void refetchErp();
        }}
      />
    </div>
  );
}
