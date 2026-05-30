import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { MarketplaceConnectionDto } from '@/types/connection';

export function useConnectionsPageMarketplace(enabled: boolean) {
  return useQuery({
    queryKey: ['marketplace-connections'],
    queryFn: async (): Promise<MarketplaceConnectionDto[]> => {
      const { data } = await api.get<MarketplaceConnectionDto[]>(
        '/marketplace-connections',
      );
      return data;
    },
    enabled,
  });
}
