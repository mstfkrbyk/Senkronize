import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/lib/api';

export type ErpSyncFrequency =
  | 'REALTIME'
  | 'EVERY_15_MIN'
  | 'HOURLY'
  | 'EVERY_4_HOURS'
  | 'DAILY'
  | 'MANUAL';

export interface ErpSyncSettingsDto {
  id: string;
  organizationId: string;
  erpConnectionId: string;
  syncFrequency: ErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertErpSyncSettingsInput {
  syncFrequency: ErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
}

export function useErpSyncSettings(
  connectionId: string | null,
): UseQueryResult<ErpSyncSettingsDto, Error> {
  return useQuery({
    queryKey: ['erp-sync-settings', connectionId],
    enabled: connectionId !== null,
    queryFn: async (): Promise<ErpSyncSettingsDto> => {
      const { data } = await api.get<{ data: ErpSyncSettingsDto }>(
        `/erp-connections/${connectionId}/sync-settings`,
      );
      return data.data;
    },
  });
}

export function useUpsertErpSyncSettings(
  connectionId: string,
): UseMutationResult<ErpSyncSettingsDto, Error, UpsertErpSyncSettingsInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: UpsertErpSyncSettingsInput,
    ): Promise<ErpSyncSettingsDto> => {
      const { data } = await api.put<{ data: ErpSyncSettingsDto }>(
        `/erp-connections/${connectionId}/sync-settings`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['erp-sync-settings', connectionId],
      });
    },
  });
}

export function useTriggerErpSyncNow(
  connectionId: string,
): UseMutationResult<{ message: string }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      const { data } = await api.post<{ message: string }>(
        `/erp-connections/${connectionId}/sync-now`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['erp-sync-settings', connectionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
      void queryClient.invalidateQueries({
        queryKey: ['erp-sync-logs', connectionId],
      });
    },
  });
}
