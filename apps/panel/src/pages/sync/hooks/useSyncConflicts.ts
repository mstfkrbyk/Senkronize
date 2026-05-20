import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AutoResolveResultDto,
  ConflictResolution,
  ConflictStatsDto,
  ConflictType,
  SyncConflictDto,
} from '@/types/sync-conflict';

export interface ConflictFilters {
  entityType?: string;
  conflictType?: ConflictType;
  status?: 'pending' | 'resolved' | 'ignored';
}

export function useSyncConflicts(filters: ConflictFilters = {}) {
  return useQuery({
    queryKey: ['sync-conflicts', filters],
    queryFn: async (): Promise<SyncConflictDto[]> => {
      const params = new URLSearchParams();
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.conflictType) params.set('conflictType', filters.conflictType);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      const { data } = await api.get<{ data: SyncConflictDto[] }>(
        `/sync/conflicts${qs ? `?${qs}` : ''}`,
      );
      return data.data;
    },
  });
}

export function useConflictStats() {
  return useQuery({
    queryKey: ['sync-conflicts', 'stats'],
    queryFn: async (): Promise<ConflictStatsDto> => {
      const { data } = await api.get<{ data: ConflictStatsDto }>(
        '/sync/conflicts/stats',
      );
      return data.data;
    },
  });
}

export function useDetectConflicts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SyncConflictDto[]> => {
      const { data } = await api.post<{ data: SyncConflictDto[] }>(
        '/sync/conflicts/detect',
      );
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sync-conflicts'] });
    },
  });
}

export function useResolveConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      resolution: ConflictResolution;
      notes?: string;
    }): Promise<void> => {
      await api.post(`/sync/conflicts/${input.id}/resolve`, {
        resolution: input.resolution,
        notes: input.notes,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sync-conflicts'] });
    },
  });
}

export function useAutoResolveConflicts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AutoResolveResultDto> => {
      const { data } = await api.post<{ data: AutoResolveResultDto }>(
        '/sync/conflicts/auto-resolve',
      );
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sync-conflicts'] });
    },
  });
}
