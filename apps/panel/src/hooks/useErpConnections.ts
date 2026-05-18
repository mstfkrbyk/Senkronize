import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/lib/api';

export interface ErpConnectionDto {
  id: string;
  erpType: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  accountLabel?: string | null;
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

export function useTestErpConnection(): UseMutationResult<
  { connected: boolean },
  Error,
  TestErpConnectionPayload
> {
  return useMutation({
    mutationFn: async (
      payload: TestErpConnectionPayload,
    ): Promise<{ connected: boolean }> => {
      const { data } = await api.post<{ connected: boolean }>(
        '/erp-connections/test',
        payload,
      );
      return data;
    },
  });
}

export function useCreateErpConnection(): UseMutationResult<
  ErpConnectionDto,
  Error,
  { erpType: string; credentials: Record<string, string> }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      erpType: string;
      credentials: Record<string, string>;
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
  { id: string; credentials: Record<string, string> }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      credentials,
    }: {
      id: string;
      credentials: Record<string, string>;
    }): Promise<ErpConnectionDto> => {
      const { data } = await api.patch<ErpConnectionDto>(`/erp-connections/${id}`, {
        credentials,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });
}
