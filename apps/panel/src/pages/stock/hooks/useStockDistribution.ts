import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  DistributionPreviewDto,
  DistributionResultDto,
  StockDistributionStrategy,
} from '@/types/sync-conflict';

export function useStockDistribution(barcode: string | undefined) {
  return useQuery({
    queryKey: ['stock', 'distribution', barcode],
    queryFn: async (): Promise<DistributionPreviewDto> => {
      const { data } = await api.get<{ data: DistributionPreviewDto }>(
        `/stock/distribution/${encodeURIComponent(barcode as string)}`,
      );
      return data.data;
    },
    enabled: typeof barcode === 'string' && barcode.trim().length > 0,
  });
}

export function usePreviewStockDistribution() {
  return useMutation({
    mutationFn: async (input: {
      barcode: string;
      strategy: StockDistributionStrategy;
      totalStock?: number;
    }): Promise<Record<string, number>> => {
      const { data } = await api.post<{ data: { distribution: Record<string, number> } }>(
        '/stock/distribute/preview',
        input,
      );
      return data.data.distribution;
    },
  });
}

export function useApplyStockDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      barcode: string;
      strategy: StockDistributionStrategy;
      totalStock?: number;
    }): Promise<DistributionResultDto> => {
      const { data } = await api.post<{ data: DistributionResultDto }>(
        '/stock/distribute',
        input,
      );
      return data.data;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({
        queryKey: ['stock', 'distribution', variables.barcode],
      });
    },
  });
}
