import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AuditLogEntry } from '@/types/audit-log';

export function useAuditLog(limit = 50) {
  return useQuery({
    queryKey: ['audit-log', limit],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data } = await api.get<AuditLogEntry[]>('/audit-log', {
        params: { limit },
      });
      return data;
    },
  });
}
