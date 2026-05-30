import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { IntegrationTableAccountingEmptyState } from '@/components/IntegrationTableAccountingEmptyState';
import { Button } from '@/components/ui/button';
import { resolvePageEmptyProductVariant } from '@/lib/page-empty-state';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  /** Pazaryeri bağlantısı yok (yüklenene kadar null). */
  hasMarketplaceConnections: boolean | null;
  connectionsLoading: boolean;
  /** Filtre sonucu boş mu (bağlantı varken veri yok). */
  hasActiveFilters?: boolean;
  onStartSync?: () => void;
  syncDisabled?: boolean;
  syncLabel?: string;
  icon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  noConnectionTitle?: string;
  noConnectionDescription?: string;
}

export function TablePageEmptyState({
  hasMarketplaceConnections,
  connectionsLoading,
  hasActiveFilters = false,
  onStartSync,
  syncDisabled = false,
  syncLabel,
  icon = ShoppingCart,
  emptyTitle,
  emptyDescription,
  noConnectionTitle,
  noConnectionDescription,
}: Props): ReactElement {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const variant = resolvePageEmptyProductVariant(orgProducts);

  if (variant === 'accounting') {
    return <IntegrationTableAccountingEmptyState />;
  }

  if (connectionsLoading || hasMarketplaceConnections === null) {
    return (
      <EmptyState
        title={t('emptyState.loading.title')}
        description={t('emptyState.loading.description')}
      />
    );
  }

  if (!hasMarketplaceConnections) {
    return (
      <EmptyState
        icon={icon}
        title={noConnectionTitle ?? t('emptyState.integration.noConnectionTitle')}
        description={
          noConnectionDescription ?? t('emptyState.integration.noConnectionDescription')
        }
        actionSlot={
          <Button type="button" variant="default" asChild>
            <Link to="/connections">{t('emptyState.integration.addFirstConnection')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={icon}
      title={
        emptyTitle ??
        (hasActiveFilters
          ? t('emptyState.integration.filteredTitle')
          : t('emptyState.integration.emptyRecordsTitle'))
      }
      description={
        emptyDescription ??
        (hasActiveFilters
          ? t('emptyState.integration.filteredDescription')
          : t('emptyState.integration.emptyRecordsDescription'))
      }
      actionSlot={
        !hasActiveFilters ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onStartSync ? (
              <Button
                type="button"
                variant="default"
                disabled={syncDisabled}
                onClick={() => {
                  onStartSync();
                }}
              >
                {syncLabel ?? t('emptyState.integration.startSync')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" asChild>
              <Link to="/connections">{t('emptyState.integration.goToConnections')}</Link>
            </Button>
          </div>
        ) : null
      }
    />
  );
}
