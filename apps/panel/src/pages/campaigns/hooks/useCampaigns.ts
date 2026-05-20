import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type {
  Campaign,
  CampaignDetail,
  CampaignImpact,
  CampaignKpiSummary,
  CampaignPerformance,
  CampaignStatus,
  CreateCampaignInput,
} from '@/types/campaign';

export function useCampaignKpis(enabled = true) {
  return useQuery({
    queryKey: ['campaigns', 'kpis'],
    queryFn: async (): Promise<CampaignKpiSummary> => {
      const { data } = await api.get<{ data: CampaignKpiSummary }>(
        '/campaigns/kpis/summary',
      );
      return data.data;
    },
    enabled,
  });
}

export function useCampaignPerformance(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['campaigns', id, 'performance'],
    queryFn: async (): Promise<CampaignPerformance> => {
      const { data } = await api.get<{ data: CampaignPerformance }>(
        `/campaigns/${id}/performance`,
      );
      return data.data;
    },
    enabled: enabled && id !== null && id !== '',
  });
}

export function useCampaigns(status?: CampaignStatus, enabled = true) {
  return useQuery({
    queryKey: ['campaigns', status ?? 'all'],
    queryFn: async (): Promise<Campaign[]> => {
      const { data } = await api.get<{ data: Campaign[] }>('/campaigns', {
        params: status ? { status } : undefined,
      });
      return data.data;
    },
    enabled,
  });
}

export function useCampaign(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async (): Promise<CampaignDetail> => {
      const { data } = await api.get<{ data: CampaignDetail }>(
        `/campaigns/${id}`,
      );
      return data.data;
    },
    enabled: enabled && id !== null && id !== '',
  });
}

export function useAnalyzeCampaign() {
  return useMutation({
    mutationFn: async (input: CreateCampaignInput): Promise<CampaignImpact> => {
      const { data } = await api.post<{ data: CampaignImpact }>(
        '/campaigns/analyze',
        input,
      );
      return data.data;
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput): Promise<Campaign> => {
      const { data } = await api.post<{ data: Campaign }>('/campaigns', input);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya oluşturuldu');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useActivateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/campaigns/${id}/activate`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya aktifleştirildi');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/campaigns/${id}/pause`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya duraklatıldı');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeactivateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/campaigns/${id}/deactivate`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya sonlandırıldı');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Campaign> => {
      const { data } = await api.post<{ data: Campaign }>(
        `/campaigns/${id}/duplicate`,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya kopyalandı');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Kampanya silindi');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
