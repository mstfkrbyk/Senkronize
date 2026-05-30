import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/lib/api';

/** Backend SyncFrequency + panel etiketleri */
export type ErpSyncFrequency =
  | 'MANUAL'
  | 'REALTIME'
  | 'EVERY_5_MIN'
  | 'EVERY_15_MIN'
  | 'EVERY_30_MIN'
  | 'HOURLY'
  | 'EVERY_4_HOURS'
  | 'DAILY';

export type ErpProductImportMode = 'ECOMMERCE_ONLY' | 'CATEGORY' | 'ALL';

export type ErpSyncScope = 'all' | 'products' | 'stock' | 'invoices';

export interface ErpSyncSettingsDto {
  id: string;
  organizationId: string;
  erpConnectionId: string;
  syncFrequency: ErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
  syncPrices?: boolean;
  syncOrders?: boolean;
  syncCustomers?: boolean;
  autoInvoiceOnDelivered?: boolean;
  productImportMode?: ErpProductImportMode;
  erpCategoryIds?: string[];
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertErpSyncSettingsInput {
  syncFrequency?: ErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
  syncPrices?: boolean;
  syncOrders?: boolean;
  syncCustomers?: boolean;
  autoInvoiceOnDelivered?: boolean;
  productImportMode?: ErpProductImportMode;
  erpCategoryIds?: string[];
}

const API_FREQUENCY_MAP: Record<ErpSyncFrequency, string> = {
  MANUAL: 'MANUAL',
  REALTIME: 'REALTIME',
  EVERY_5_MIN: 'REALTIME',
  EVERY_15_MIN: 'EVERY_15_MIN',
  EVERY_30_MIN: 'HOURLY',
  HOURLY: 'HOURLY',
  EVERY_4_HOURS: 'EVERY_4_HOURS',
  DAILY: 'DAILY',
};

const UI_FREQUENCY_FROM_API: Record<string, ErpSyncFrequency> = {
  MANUAL: 'MANUAL',
  REALTIME: 'EVERY_5_MIN',
  EVERY_15_MIN: 'EVERY_15_MIN',
  HOURLY: 'HOURLY',
  EVERY_4_HOURS: 'EVERY_4_HOURS',
  DAILY: 'DAILY',
};

export function toApiSyncFrequency(frequency: ErpSyncFrequency): string {
  return API_FREQUENCY_MAP[frequency] ?? 'HOURLY';
}

export function fromApiSyncFrequency(apiValue: string): ErpSyncFrequency {
  return UI_FREQUENCY_FROM_API[apiValue] ?? (apiValue as ErpSyncFrequency);
}

function toApiPayload(body: UpsertErpSyncSettingsInput): Record<string, unknown> {
  return {
    ...(body.syncFrequency
      ? { syncFrequency: toApiSyncFrequency(body.syncFrequency) }
      : {}),
    syncStock: body.syncStock,
    syncProducts: body.syncProducts,
    syncInvoices: body.syncOrders ?? body.syncInvoices,
    syncCustomers: body.syncCustomers,
    autoCreateInvoice: body.autoInvoiceOnDelivered,
    ...(body.productImportMode ? { productImportMode: body.productImportMode } : {}),
    ...(body.erpCategoryIds ? { erpCategoryIds: body.erpCategoryIds } : {}),
  };
}

function normalizeSettingsDto(raw: ErpSyncSettingsDto): ErpSyncSettingsDto {
  return {
    ...raw,
    syncFrequency: fromApiSyncFrequency(raw.syncFrequency),
    syncOrders: raw.syncOrders ?? raw.syncInvoices,
    syncPrices: raw.syncPrices ?? raw.syncProducts,
    syncCustomers: raw.syncCustomers ?? false,
    autoInvoiceOnDelivered:
      raw.autoInvoiceOnDelivered ?? (raw as { autoCreateInvoice?: boolean }).autoCreateInvoice ?? false,
    productImportMode:
      raw.productImportMode === 'ECOMMERCE_ONLY' ||
      raw.productImportMode === 'CATEGORY' ||
      raw.productImportMode === 'ALL'
        ? raw.productImportMode
        : 'ECOMMERCE_ONLY',
    erpCategoryIds: raw.erpCategoryIds ?? [],
  };
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
      return normalizeSettingsDto(data.data);
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
      const payload = toApiPayload(body);
      try {
        const { data } = await api.patch<{ data: ErpSyncSettingsDto }>(
          `/erp-connections/${connectionId}/sync-settings`,
          payload,
        );
        return normalizeSettingsDto(data.data);
      } catch {
        const { data } = await api.put<{ data: ErpSyncSettingsDto }>(
          `/erp-connections/${connectionId}/sync-settings`,
          payload,
        );
        return normalizeSettingsDto(data.data);
      }
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
): UseMutationResult<{ message: string }, Error, ErpSyncScope | undefined> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scope: ErpSyncScope | undefined = 'all'): Promise<{ message: string }> => {
      try {
        const { data } = await api.post<{ message: string }>(
          `/erp-connections/${connectionId}/sync`,
          { scope },
        );
        return data;
      } catch {
        const { data } = await api.post<{ message: string }>(
          `/erp-connections/${connectionId}/sync-now`,
        );
        return data;
      }
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
