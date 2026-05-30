import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import {
  normalizeErpTestConnectionResult,
  type ErpTestConnectionResult,
} from '@/lib/connection-test-message';

export interface ErpConnectionDto {
  id: string;
  erpType: string;
  displayName?: string | null;
  role: 'PRIMARY' | 'SECONDARY';
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  accountLabel?: string | null;
  productMatchKey?: 'BARCODE' | 'SKU' | 'MANUAL' | null;
}

export type TestErpConnectionPayload =
  | { connectionId: string }
  | { erpType: string; credentials: Record<string, string> };

export function useErpConnections(): UseQueryResult<ErpConnectionDto[], Error> {
  return useQuery({
    queryKey: ['erp-connections'],
    queryFn: async (): Promise<ErpConnectionDto[]> => {
      const { data } = await api.get<ErpConnectionDto[]>('/erp-connections');
      return data;
    },
  });
}

export type { ErpTestConnectionResult } from '@/lib/connection-test-message';

export function useTestErpConnection(): UseMutationResult<
  ErpTestConnectionResult,
  Error,
  TestErpConnectionPayload
> {
  return useMutation({
    mutationFn: async (
      payload: TestErpConnectionPayload,
    ): Promise<ErpTestConnectionResult> => {
      const { data } = await api.post<ErpTestConnectionResult | { data: ErpTestConnectionResult }>(
        '/erp-connections/test',
        payload,
      );
      return normalizeErpTestConnectionResult(data);
    },
  });
}

export function useTestErpConnectionById(
  connectionId: string,
): UseMutationResult<ErpTestConnectionResult, Error, void> {
  return useMutation({
    mutationFn: async (): Promise<ErpTestConnectionResult> => {
      try {
        const { data } = await api.post<ErpTestConnectionResult | { data: ErpTestConnectionResult }>(
          `/erp-connections/${connectionId}/test`,
        );
        return normalizeErpTestConnectionResult(data);
      } catch {
        const { data } = await api.post<ErpTestConnectionResult | { data: ErpTestConnectionResult }>(
          '/erp-connections/test',
          { connectionId },
        );
        return normalizeErpTestConnectionResult(data);
      }
    },
  });
}

export function useCreateErpConnection(): UseMutationResult<
  ErpConnectionDto,
  Error,
  {
    erpType: string;
    credentials: Record<string, string>;
    displayName?: string;
    role?: 'PRIMARY' | 'SECONDARY';
  }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      erpType: string;
      credentials: Record<string, string>;
      displayName?: string;
      role?: 'PRIMARY' | 'SECONDARY';
    }): Promise<ErpConnectionDto> => {
      const { data } = await api.post<ErpConnectionDto>('/erp-connections', body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });
}

export function useDeleteErpConnection(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<unknown> => {
      const { data } = await api.delete<unknown>(`/erp-connections/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });
}

export function useToggleErpConnection(): UseMutationResult<
  ErpConnectionDto,
  Error,
  { id: string; isActive: boolean }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }): Promise<ErpConnectionDto> => {
      const { data } = await api.patch<ErpConnectionDto>(`/erp-connections/${id}`, {
        isActive,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });
}

export function useUpdateErpConnection(): UseMutationResult<
  ErpConnectionDto,
  Error,
  {
    id: string;
    credentials?: Record<string, string>;
    productMatchKey?: 'BARCODE' | 'SKU' | 'MANUAL' | null;
    displayName?: string;
  }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      credentials,
      productMatchKey,
      displayName,
    }: {
      id: string;
      credentials?: Record<string, string>;
      productMatchKey?: 'BARCODE' | 'SKU' | 'MANUAL' | null;
      displayName?: string;
    }): Promise<ErpConnectionDto> => {
      const { data } = await api.patch<ErpConnectionDto>(`/erp-connections/${id}`, {
        ...(credentials !== undefined ? { credentials } : {}),
        ...(productMatchKey !== undefined ? { productMatchKey } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });
}

export function useSetPrimaryErpConnection(): UseMutationResult<
  ErpConnectionDto,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<ErpConnectionDto> => {
      const { data } = await api.post<{ data: ErpConnectionDto }>(
        `/erp-connections/${id}/set-primary`,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
      void queryClient.invalidateQueries({ queryKey: ['erp-sync-settings'] });
    },
  });
}

export function useSyncOrderToErp(): UseMutationResult<
  { invoiceNo: string },
  Error,
  { connectionId: string; orderId: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      connectionId,
      orderId,
    }: {
      connectionId: string;
      orderId: string;
    }): Promise<{ invoiceNo: string }> => {
      const { data } = await api.post<{ invoiceNo: string }>(
        `/erp-connections/${connectionId}/sync-order/${orderId}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
