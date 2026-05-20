import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  BuyBoxListingAnalysis,
  BuyBoxReport,
  BuyBoxSummary,
  BuyBoxWinRateStats,
  CompetitorPriceRow,
  CompetitorMatrixRow,
  PriceGapAnalysis,
  PriceAlertsResponse,
  ListingPriceHistoryResult,
  PriceHistoryEntry,
  PriceSimulationResult,
  PriceTrendPoint,
  PricingRule,
} from '@/types/pricing';

export function useBuyBoxReport(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'buybox-report'],
    queryFn: async (): Promise<BuyBoxReport> => {
      const { data } = await api.get<BuyBoxReport>('/pricing/buybox-report');
      return data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useSimulatePrice() {
  return useMutation({
    mutationFn: async (input: {
      listingId: string;
      salePrice: number;
      costPrice?: number;
    }): Promise<PriceSimulationResult> => {
      const { data } = await api.post<PriceSimulationResult>(
        '/pricing/simulate',
        input,
      );
      return data;
    },
  });
}

export function useBuyBoxSummary(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'buybox'],
    queryFn: async (): Promise<BuyBoxSummary> => {
      const { data } = await api.get<BuyBoxSummary>('/pricing/buybox');
      return data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function usePricingRules(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'rules'],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data } = await api.get<PricingRule[]>('/pricing/rules');
      return data;
    },
    enabled,
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

export function useBuyBoxWinRate(days = 7, enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'win-rate', days],
    queryFn: async (): Promise<BuyBoxWinRateStats> => {
      const { data } = await api.get<BuyBoxWinRateStats>('/pricing/win-rate', {
        params: { days },
      });
      return data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useBuyBoxListingAnalysis(
  listingId: string | null,
  queryEnabled = true,
) {
  return useQuery({
    queryKey: ['pricing', 'buybox-analysis', listingId],
    queryFn: async (): Promise<BuyBoxListingAnalysis> => {
      const { data } = await api.get<BuyBoxListingAnalysis>(
        `/pricing/buybox-analysis/${listingId}`,
      );
      return data;
    },
    enabled:
      queryEnabled && listingId != null && listingId.length > 0,
    staleTime: 15_000,
  });
}

export function usePriceHistory(
  filters?: { barcode?: string; platform?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ['pricing', 'history', filters],
    queryFn: async (): Promise<{ items: PriceHistoryEntry[]; total: number }> => {
      const { data } = await api.get<{ items: PriceHistoryEntry[]; total: number }>(
        '/pricing/history',
        { params: filters },
      );
      return data;
    },
    enabled,
  });
}

export function useScheduledRules(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'scheduled-rules'],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data } = await api.get<PricingRule[]>('/pricing/scheduled-rules');
      return data;
    },
    enabled,
  });
}

export function useScheduleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      daysOfWeek?: number[];
      hoursStart?: number | null;
      hoursEnd?: number | null;
    }): Promise<PricingRule> => {
      const { data } = await api.patch<PricingRule>(
        `/pricing/rules/${input.id}/schedule`,
        {
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          daysOfWeek: input.daysOfWeek,
          hoursStart: input.hoursStart,
          hoursEnd: input.hoursEnd,
        },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing'] });
      toast.success('Zamanlama kaydedildi');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useCompetitorPrices(barcode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'competitor-prices', barcode],
    queryFn: async (): Promise<CompetitorPriceRow[]> => {
      const { data } = await api.get<CompetitorPriceRow[]>(
        `/pricing/competitor-prices/${encodeURIComponent(barcode!)}`,
      );
      return data;
    },
    enabled: enabled && barcode != null && barcode.length > 0,
  });
}

export function usePriceGap(barcode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'price-gap', barcode],
    queryFn: async (): Promise<PriceGapAnalysis> => {
      const { data } = await api.get<PriceGapAnalysis>(
        `/pricing/price-gap/${encodeURIComponent(barcode!)}`,
      );
      return data;
    },
    enabled: enabled && barcode != null && barcode.length > 0,
  });
}

export function usePriceTrend(
  barcode: string | null,
  platform: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ['pricing', 'price-trend', barcode, platform],
    queryFn: async (): Promise<PriceTrendPoint[]> => {
      const { data } = await api.get<PriceTrendPoint[]>(
        `/pricing/price-trend/${encodeURIComponent(barcode!)}`,
        { params: { platform } },
      );
      return data;
    },
    enabled:
      enabled &&
      barcode != null &&
      barcode.length > 0 &&
      platform != null &&
      platform.length > 0,
  });
}

export function useManualPricingUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      barcode: string;
      platform: string;
      salePrice: number;
      listPrice: number;
    }): Promise<void> => {
      await api.post('/pricing/manual', input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing'] });
      toast.success('Fiyat güncellendi');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useListingPriceHistory(
  listingId: string | null,
  days = 30,
  enabled = true,
) {
  return useQuery({
    queryKey: ['pricing', 'price-history', listingId, days],
    queryFn: async (): Promise<ListingPriceHistoryResult> => {
      const { data } = await api.get<ListingPriceHistoryResult>(
        `/pricing/price-history/${listingId}`,
        { params: { days } },
      );
      return data;
    },
    enabled: enabled && listingId != null && listingId.length > 0,
    staleTime: 30_000,
  });
}

export function useCompetitorMatrix(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'competitor-matrix'],
    queryFn: async (): Promise<CompetitorMatrixRow[]> => {
      const { data } = await api.get<CompetitorMatrixRow[]>(
        '/pricing/competitor-matrix',
      );
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function usePriceAlerts(enabled = true) {
  return useQuery({
    queryKey: ['pricing', 'price-alerts'],
    queryFn: async (): Promise<PriceAlertsResponse> => {
      const { data } = await api.get<PriceAlertsResponse>(
        '/pricing/price-alerts',
      );
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreatePriceAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listingId: string;
      thresholdPrice: number;
      notifyEmail?: boolean;
      notifyInApp?: boolean;
      notifySms?: boolean;
    }): Promise<{ id: string }> => {
      const { data } = await api.post<{ id: string }>(
        '/pricing/price-alerts',
        input,
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pricing', 'price-alerts'] });
      toast.success('Fiyat uyarısı eklendi');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
