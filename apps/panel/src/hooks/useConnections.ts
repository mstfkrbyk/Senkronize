import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  CreateConnectionPayload,
  MarketplaceConnectionDto,
  TestConnectionPayload,
  UpdateConnectionPayload,
} from '@/types/connection';

export function useMarketplaceConnections(): ReturnType<
  typeof useQuery<MarketplaceConnectionDto[]>
> {
  return useQuery({
    queryKey: ['marketplace-connections'],
    queryFn: async (): Promise<MarketplaceConnectionDto[]> => {
      const { data } = await api.get<MarketplaceConnectionDto[]>(
        '/marketplace-connections',
      );
      return data;
    },
  });
}

export function useTestConnection(): ReturnType<
  typeof useMutation<{ connected: boolean }, Error, TestConnectionPayload>
> {
  return useMutation({
    mutationFn: async (
      payload: TestConnectionPayload,
    ): Promise<{ connected: boolean }> => {
      const { data } = await api.post<{ connected: boolean }>(
        '/marketplace-connections/test',
        payload,
      );
      return data;
    },
  });
}

export function useCreateConnection(): ReturnType<
  typeof useMutation<MarketplaceConnectionDto, Error, CreateConnectionPayload>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: CreateConnectionPayload,
    ): Promise<MarketplaceConnectionDto> => {
      const { data } = await api.post<MarketplaceConnectionDto>(
        '/marketplace-connections',
        body,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
    },
  });
}

export function useUpdateMarketplaceConnection(): ReturnType<
  typeof useMutation<
    MarketplaceConnectionDto,
    Error,
    { id: string } & UpdateConnectionPayload
  >
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
    } & UpdateConnectionPayload): Promise<MarketplaceConnectionDto> => {
      const { data } = await api.patch<MarketplaceConnectionDto>(
        `/marketplace-connections/${id}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
    },
  });
}

export function useDeleteConnection(): ReturnType<
  typeof useMutation<unknown, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<unknown> => {
      const { data } = await api.delete<unknown>(
        `/marketplace-connections/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
    },
  });
}

export function useTriggerManualSync(): ReturnType<
  typeof useMutation<{ message: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string): Promise<{ message: string }> => {
      const { data } = await api.post<{ message: string }>(
        `/sync/${connectionId}/trigger`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
    },
  });
}
