import { useMemo } from 'react';

import { useMarketplaceConnections } from '@/hooks/useConnections';
import { marketplaceKind } from '@/pages/connections/connection-utils';

/** Aktif pazaryeri (Trendyol, HB vb.) bağlantısı var mı — e-ticaret siteleri hariç. */
export function useHasMarketplacePlatforms(): boolean {
  const connectionsQuery = useMarketplaceConnections();

  return useMemo(() => {
    const connections = connectionsQuery.data ?? [];
    return connections.some(
      (c) => c.isActive && marketplaceKind(c.platform) === 'marketplace',
    );
  }, [connectionsQuery.data]);
}
