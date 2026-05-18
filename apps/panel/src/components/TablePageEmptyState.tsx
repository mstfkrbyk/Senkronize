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
        title="Henüz bağlantı eklenmedi"
        description="Pazaryeri verilerinizi görmek için önce bir bağlantı ekleyin."
        actionSlot={
          <Button type="button" variant="default" asChild>
            <Link to="/connections">Bağlantılar sayfasına git</Link>
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title={hasActiveFilters ? 'Filtrelere uygun kayıt yok' : 'Henüz veri çekilmedi'}
      description={
        hasActiveFilters
          ? 'Filtreleri gevşeterek veya temizleyerek tekrar deneyin.'
          : 'Pazaryeri listesini veya siparişleri henüz çekmediniz. Senkronizasyonu başlatarak veri oluşturabilirsiniz.'
      }
      actionSlot={
        onStartSync && !hasActiveFilters ? (
          <Button
            type="button"
            variant="outline"
            disabled={syncDisabled}
            onClick={() => {
              onStartSync();
            }}
          >
            {syncLabel}
          </Button>
        ) : null
      }
    />
  );
}
