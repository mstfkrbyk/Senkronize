import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  StockEntry,
  StockMovementDto,
  StockOverviewRow,
  WarehouseDto,
} from '@/types/stock';

export interface StockHistoryFilters {
  from?: string;
  to?: string;
  movementType?: string;
  barcode?: string;
  platform?: string;
  page?: number;
  limit?: number;
}

export interface MovementSummaryResponse {
  from: string;
  to: string;
  byType: Record<string, number>;
}

export function useStockOverview() {
  return useQuery({
    queryKey: ['stock', 'overview'],
    queryFn: async (): Promise<StockOverviewRow[]> => {
      const { data } = await api.get<{ rows: StockOverviewRow[] }>(
        '/stock/overview',
      );
      return data.rows;
    },
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async (): Promise<WarehouseDto[]> => {
      const { data } = await api.get<{ data: WarehouseDto[] }>('/warehouses');
      return data.data;
    },
  });
}

export function useWarehouseStock(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['warehouses', warehouseId, 'stock'],
    queryFn: async (): Promise<StockEntry[]> => {
      const { data } = await api.get<{ data: StockEntry[] }>(
        `/warehouses/${warehouseId as string}/stock`,
      );
      return data.data;
    },
    enabled: typeof warehouseId === 'string' && warehouseId.length > 0,
  });
}

export function useStockHistoryOrg(filters: StockHistoryFilters) {
  return useQuery({
    queryKey: ['stock', 'history', 'org', filters],
    queryFn: async (): Promise<{ data: StockMovementDto[]; total: number }> => {
      const { data } = await api.get<{
        data: StockMovementDto[];
        total: number;
      }>('/stock/history', { params: filters });
      return data;
    },
  });
}

export function useStockHistoryBarcode(
  barcode: string | undefined,
  filters: Omit<StockHistoryFilters, 'barcode' | 'page'>,
) {
  return useQuery({
    queryKey: ['stock', 'history', 'barcode', barcode, filters],
    queryFn: async (): Promise<StockMovementDto[]> => {
      const enc = encodeURIComponent(barcode ?? '');
      const { data } = await api.get<{ data: StockMovementDto[] }>(
        `/stock/history/${enc}`,
        { params: filters },
      );
      return data.data;
    },
    enabled: typeof barcode === 'string' && barcode.trim().length > 0,
  });
}

export function useStockSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['stock', 'summary', from, to],
    queryFn: async (): Promise<MovementSummaryResponse> => {
      const { data } = await api.get<MovementSummaryResponse>('/stock/summary', {
        params: { from, to },
      });
      return data;
    },
    enabled: from.length > 0 && to.length > 0,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      barcode: string;
      newQuantity: number;
      note?: string;
    }): Promise<void> => {
      await api.post('/stock/adjust', payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      address?: string;
    }): Promise<WarehouseDto> => {
      const { data } = await api.post<{ data: WarehouseDto }>(
        '/warehouses',
        payload,
      );
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      fromWarehouseId: string;
      toWarehouseId: string;
      barcode: string;
      quantity: number;
    }): Promise<void> => {
      await api.post('/warehouses/transfer', payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useSetDefaultWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/warehouses/${id}/set-default`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/warehouses/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}
