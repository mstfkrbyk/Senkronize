import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ShoppingCart } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

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
  syncLabel = 'Senkronizasyonu başlat',
  icon = ShoppingCart,
  emptyTitle,
  emptyDescription,
  noConnectionTitle = 'Bağlantı yok',
  noConnectionDescription = 'Sipariş ve listelerinizi görmek için önce pazaryeri bağlantınızı ekleyin.',
}: Props): ReactElement {
  if (connectionsLoading || hasMarketplaceConnections === null) {
    return (
      <EmptyState
        title="Yükleniyor…"
        description="Bağlantı durumu kontrol ediliyor."
      />
    );
  }

  if (!hasMarketplaceConnections) {
    return (
      <EmptyState
        icon={icon}
        title={noConnectionTitle}
        description={noConnectionDescription}
        actionSlot={
          <Button type="button" variant="default" asChild>
            <Link to="/connections">İlk bağlantınızı ekleyin</Link>
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
        (hasActiveFilters ? 'Filtrelere uygun kayıt yok' : 'Henüz kayıt yok')
      }
      description={
        emptyDescription ??
        (hasActiveFilters
          ? 'Filtreleri gevşeterek veya temizleyerek tekrar deneyin.'
          : 'Aktif bağlantılarınızdan veri geldikten sonra kayıtlar burada görünür. Senkronizasyonu başlatabilir veya bağlantılarınızı yönetebilirsiniz.')
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
                {syncLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" asChild>
              <Link to="/connections">Bağlantılara git</Link>
            </Button>
          </div>
        ) : null
      }
    />
  );
}
