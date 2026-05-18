import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  ListingDetailResponse,
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
    staleTime: 60_000,
  });
}

export function useListingDetail(listingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['listings', 'detail', listingId],
    queryFn: async (): Promise<ListingDetailResponse> => {
      const { data } = await api.get<ListingDetailResponse>(
        `/listings/${listingId}/detail`,
      );
      return data;
    },
    enabled: Boolean(listingId) && enabled,
    staleTime: 30_000,
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

export function useSyncAllPlatforms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      barcode: string;
      quantity: number;
      price?: number;
    }): Promise<{ queued: number }> => {
      const { data } = await api.post<{ queued: number }>(
        '/products/sync-all-platforms',
        payload,
      );
      return data;
    },
    onSuccess: (res) => {
      toast.success(
        res.queued > 0
          ? `${String(res.queued)} bağlantıda kuyruğa alındı`
          : 'Aktif bağlantı yok',
      );
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
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
    onSuccess: (_, variables) => {
      toast.success('Fiyat güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({
        queryKey: ['listings', 'detail', variables.id],
      });
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
    onSuccess: (_, variables) => {
      toast.success('Stok güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({
        queryKey: ['listings', 'detail', variables.id],
      });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export interface BulkListingUpdateItem {
  listingId?: string;
  barcode?: string;
  quantity?: number;
  salePrice?: number;
  listPrice?: number;
}

export function useBulkListingUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: BulkListingUpdateItem[],
    ): Promise<{ updated: number }> => {
      const { data } = await api.post<{ updated: number }>(
        '/listings/bulk-update',
        { items },
      );
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.updated)} listeleme güncellendi`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({
        queryKey: ['reports', 'dashboard-summary'],
      });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
