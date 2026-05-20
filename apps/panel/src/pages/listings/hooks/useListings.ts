import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  BulkPriceUpdateItem,
  BulkResult,
  ListingDetailResponse,
  ListingFilters,
  ListingKpis,
  ListingsResponse,
  ListingStatus,
  ListingSummary,
} from '@/types/listing';
import type { BuyBoxSummary } from '@/types/pricing';

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

export function useListings(filters: ListingFilters, enabled = true) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async (): Promise<ListingsResponse> => {
      const { data } = await api.get<ListingsResponse>('/listings', {
        params: buildListingParams(filters),
      });
      return data;
    },
    staleTime: 60_000,
    enabled,
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

interface ConflictStatsResponse {
  pending: number;
  resolved: number;
  ignored: number;
  byType: {
    STOCK_MISMATCH: number;
    PRICE_MISMATCH: number;
    STATUS_MISMATCH: number;
    PRODUCT_NOT_FOUND: number;
    DUPLICATE_ORDER: number;
  };
}

export function useListingKpis() {
  return useQuery({
    queryKey: ['listings', 'kpis'],
    queryFn: async (): Promise<ListingKpis> => {
      const [activeRes, conflictRes, buyBoxRes] = await Promise.all([
        api.get<ListingsResponse>('/listings', {
          params: { status: 'ACTIVE', page: 1, limit: 1 },
        }),
        api.get<{ data: ConflictStatsResponse }>('/sync/conflicts/stats'),
        api.get<BuyBoxSummary>('/pricing/buybox'),
      ]);

      return {
        activeCount: activeRes.data.total,
        priceMismatchCount: conflictRes.data.data.byType.PRICE_MISMATCH,
        stockMismatchCount: conflictRes.data.data.byType.STOCK_MISMATCH,
        buyBoxWinRatePct: buyBoxRes.data.winRate,
      };
    },
    staleTime: 60_000,
  });
}

export function useBuyBoxSnapshotMap(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'buybox', 'snapshots-map'],
    queryFn: async (): Promise<Map<string, { isWinner: boolean; buyBoxPrice: number }>> => {
      const { data } = await api.get<BuyBoxSummary>('/pricing/buybox');
      const map = new Map<string, { isWinner: boolean; buyBoxPrice: number }>();
      for (const snap of data.snapshots ?? []) {
        map.set(`${snap.barcode}:${snap.platform}`, {
          isWinner: snap.isWinner,
          buyBoxPrice: Number(snap.buyBoxPrice),
        });
      }
      return map;
    },
    staleTime: 60_000,
    enabled,
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

export function useSyncListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string): Promise<{ jobIds: string[] }> => {
      const { data } = await api.post<{ jobIds: string[] }>(
        `/listings/${listingId}/sync`,
      );
      return data;
    },
    onSuccess: (_, listingId) => {
      toast.success('Senkronizasyon kuyruğa alındı');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({
        queryKey: ['listings', 'detail', listingId],
      });
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

export function useToggleListingActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string) => {
      const { data } = await api.patch(`/listings/${listingId}/toggle-active`);
      return data;
    },
    onSuccess: () => {
      toast.success('Durum güncellendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids: string[];
      status: ListingStatus;
    }): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>('/listings/bulk/status', payload);
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} listeleme güncellendi`);
      if (res.failed > 0) {
        toast.warning(`${String(res.failed)} kayıt güncellenemedi`);
      }
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      updates: { id: string; price: number }[],
    ): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>(
        '/listings/bulk/price',
        updates,
      );
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} fiyat güncellendi`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

/** Toplu fiyat güncelleme — PATCH `/listings/bulk/price` (fallback: POST). */
export function useBulkPriceUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: BulkPriceUpdateItem[]): Promise<BulkResult> => {
      try {
        const { data } = await api.patch<BulkResult>(
          '/listings/bulk/price',
          updates,
        );
        return data;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 405) {
          const { data } = await api.post<BulkResult>(
            '/listings/bulk/price',
            updates,
          );
          return data;
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} fiyat güncellendi`);
      if (res.failed > 0) {
        toast.warning(`${String(res.failed)} kayıt güncellenemedi`);
      }
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      updates: { id: string; stock: number }[],
    ): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>(
        '/listings/bulk/stock',
        updates,
      );
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} stok güncellendi`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>('/listings/bulk/push', {
        ids,
      });
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} listeleme platforma gönderildi`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<{ synced: number }> => {
      let synced = 0;
      for (const id of ids) {
        await api.post(`/listings/${id}/sync`);
        synced += 1;
      }
      return { synced };
    },
    onSuccess: (res) => {
      toast.success(`${String(res.synced)} listeleme senkronizasyon kuyruğuna alındı`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useBulkListingDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<{ deleted: number }> => {
      let deleted = 0;
      for (const id of ids) {
        await api.delete(`/listings/${id}`);
        deleted += 1;
      }
      return { deleted };
    },
    onSuccess: (res) => {
      toast.success(`${String(res.deleted)} listeleme platformdan kaldırıldı`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
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
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string): Promise<void> => {
      await api.delete(`/listings/${listingId}`);
    },
    onSuccess: () => {
      toast.success('Listeleme arşivlendi');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

/** @deprecated useBulkListingPush veya useSyncListing tercih edin */
export function useSyncAllPlatforms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { listingIds: string[] }): Promise<BulkResult> => {
      const { data } = await api.post<BulkResult>('/listings/bulk/push', {
        ids: payload.listingIds,
      });
      return data;
    },
    onSuccess: (res) => {
      toast.success(`${String(res.success)} listeleme kuyruğa alındı`);
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
