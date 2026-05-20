import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export type UnifiedConnectionType =
  | 'MARKETPLACE'
  | 'ERP'
  | 'CARGO'
  | 'ECOMMERCE';

export type UnifiedConnectionStatus =
  | 'healthy'
  | 'warning'
  | 'error'
  | 'unknown'
  | 'inactive';

export interface UnifiedConnectionItem {
  id: string;
  type: UnifiedConnectionType;
  platform: string;
  name: string;
  status: UnifiedConnectionStatus;
  lastSyncAt: string | null;
  syncFrequency: string | null;
}

export function useUnifiedConnections(): ReturnType<
  typeof useQuery<UnifiedConnectionItem[]>
> {
  return useQuery({
    queryKey: ['connections', 'unified'],
    queryFn: async (): Promise<UnifiedConnectionItem[]> => {
      const { data } = await api.get<{ data: UnifiedConnectionItem[] }>('/connections');
      return data.data;
    },
  });
}

export function useCargoConnections(): ReturnType<
  typeof useQuery<UnifiedConnectionItem[]>
> {
  return useQuery({
    queryKey: ['connections', 'unified', 'cargo'],
    queryFn: async (): Promise<UnifiedConnectionItem[]> => {
      const { data } = await api.get<{ data: UnifiedConnectionItem[] }>('/connections');
      return data.data.filter((c) => c.type === 'CARGO');
    },
  });
}
