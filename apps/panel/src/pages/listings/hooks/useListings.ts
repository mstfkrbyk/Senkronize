import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  ListingFilters,
  ListingsResponse,
  ListingSummary,
} from '@/types/listing';

function buildListingParams(
  filters: ListingFilters,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') {
      continue;
    }
    params[key] = value;
  }
  return params;
}

export function useListings(filters: ListingFilters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async (): Promise<ListingsResponse> => {
      const { data } = await api.get<ListingsResponse>('/listings', {
        params: buildListingParams(filters),
      });
      return data;
    },
  });
}

export function useListingSummary() {
  return useQuery({
    queryKey: ['listings', 'summary'],
    queryFn: async (): Promise<ListingSummary> => {
      const { data } = await api.get<ListingSummary>('/listings/summary');
      return data;
    },
    staleTime: 60_000,
  });
}

export function useSyncListings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<unknown> => {
      const { data } = await api.post<unknown>('/listings/sync');
      return data;
    },
    onSuccess: () => {
      toast.info('Senkronizasyon başlatıldı');
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['listings'] });
      }, 5000);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useUpdatePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      salePrice: number;
      listPrice: number;
    }): Promise<unknown> => {
      const { data } = await api.patch<unknown>(
        `/listings/${payload.id}/price`,
        {
          salePrice: payload.salePrice,
          listPrice: payload.listPrice,
        },
      );
      return data;
    },
    onSuccess: () => {
      toast.success('Fiyat güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      quantity: number;
    }): Promise<unknown> => {
      const { data } = await api.patch<unknown>(
        `/listings/${payload.id}/stock`,
        { quantity: payload.quantity },
      );
      return data;
    },
    onSuccess: () => {
      toast.success('Stok güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
