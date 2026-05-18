import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';

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
}

export function TablePageEmptyState({
  hasMarketplaceConnections,
  connectionsLoading,
  hasActiveFilters = false,
  onStartSync,
  syncDisabled = false,
  syncLabel = 'Senkronizasyonu başlat',
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
        title="Bağlantı yok"
        description="Sipariş ve listelerinizi görmek için önce pazaryeri bağlantınızı ekleyin."
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
      title={hasActiveFilters ? 'Filtrelere uygun kayıt yok' : 'Henüz kayıt yok'}
      description={
        hasActiveFilters
          ? 'Filtreleri gevşeterek veya temizleyerek tekrar deneyin.'
          : 'Aktif bağlantılarınızdan veri geldikten sonra kayıtlar burada görünür. Senkronizasyonu başlatabilir veya bağlantılarınızı yönetebilirsiniz.'
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
