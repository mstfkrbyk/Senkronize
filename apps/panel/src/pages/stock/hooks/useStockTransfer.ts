import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  StockTransferDetail,
  StockTransferRow,
  TransferStatusApi,
} from '@/types/stock-transfer';

export interface TransferListFilters {
  status?: TransferStatusApi;
  page?: number;
  limit?: number;
}

export function useStockTransfers(filters: TransferListFilters) {
  return useQuery({
    queryKey: ['stock', 'transfers', filters],
    queryFn: async (): Promise<{ data: StockTransferRow[]; total: number }> => {
      const { data } = await api.get<{
        data: StockTransferRow[];
        total: number;
      }>('/stock/transfers', { params: filters });
      return data;
    },
  });
}

export function useStockTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['stock', 'transfers', id],
    queryFn: async (): Promise<StockTransferDetail> => {
      const { data } = await api.get<{ data: StockTransferDetail }>(
        `/stock/transfers/${id as string}`,
      );
      return data.data;
    },
    enabled: typeof id === 'string' && id.length > 0,
  });
}

export function useCreateStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      fromWarehouseId: string;
      toWarehouseId: string;
      note?: string;
      items: { productId: string; quantity: number }[];
    }): Promise<StockTransferDetail> => {
      const { data } = await api.post<{ data: StockTransferDetail }>(
        '/stock/transfers',
        payload,
      );
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stock', 'transfers'] });
    },
  });
}

export function useConfirmStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<StockTransferDetail> => {
      const { data } = await api.patch<{ data: StockTransferDetail }>(
        `/stock/transfers/${id}/confirm`,
      );
      return data.data;
    },
    onSuccess: async (_data, id) => {
      await qc.invalidateQueries({ queryKey: ['stock', 'transfers'] });
      await qc.invalidateQueries({ queryKey: ['stock', 'transfers', id] });
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useCancelStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<StockTransferDetail> => {
      const { data } = await api.patch<{ data: StockTransferDetail }>(
        `/stock/transfers/${id}/cancel`,
      );
      return data.data;
    },
    onSuccess: async (_data, id) => {
      await qc.invalidateQueries({ queryKey: ['stock', 'transfers'] });
      await qc.invalidateQueries({ queryKey: ['stock', 'transfers', id] });
    },
  });
}
