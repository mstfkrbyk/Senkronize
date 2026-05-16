import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  BuyBoxSummary,
  PriceHistoryEntry,
  PricingRule,
} from '@/types/pricing';

export function useBuyBoxSummary() {
  return useQuery({
    queryKey: ['pricing', 'buybox'],
    queryFn: async (): Promise<BuyBoxSummary> => {
      const { data } = await api.get<BuyBoxSummary>('/pricing/buybox');
      return data;
    },
    staleTime: 30_000,
  });
}

export function usePricingRules() {
  return useQuery({
    queryKey: ['pricing', 'rules'],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data } = await api.get<PricingRule[]>('/pricing/rules');
      return data;
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PricingRule>): Promise<unknown> => {
      const { data: res } = await api.post<unknown>('/pricing/rules', data);
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing', 'rules'] });
      void qc.invalidateQueries({ queryKey: ['pricing', 'buybox'] });
      toast.success('Kural oluşturuldu');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useRunPricing() {
  return useMutation({
    mutationFn: async (): Promise<unknown> => {
      const { data } = await api.post<unknown>('/pricing/run');
      return data;
    },
    onSuccess: () => {
      toast.success('Fiyatlandırma motoru çalıştırıldı');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/pricing/rules/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing', 'rules'] });
      void qc.invalidateQueries({ queryKey: ['pricing', 'buybox'] });
      toast.success('Kural silindi');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useUpdatePricingRuleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }): Promise<unknown> => {
      const { data } = await api.patch<unknown>(`/pricing/rules/${input.id}`, {
        isActive: input.isActive,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing', 'rules'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function usePriceHistory(filters?: { barcode?: string; platform?: string }) {
  return useQuery({
    queryKey: ['pricing', 'history', filters],
    queryFn: async (): Promise<{ items: PriceHistoryEntry[]; total: number }> => {
      const { data } = await api.get<{ items: PriceHistoryEntry[]; total: number }>(
        '/pricing/history',
        { params: filters },
      );
      return data;
    },
  });
}
