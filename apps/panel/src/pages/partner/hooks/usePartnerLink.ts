import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AdminPartnerLinkRequest, AdminPartnerRow } from '@/types/admin';
import type { PartnerListItem } from '@/types/partner';

export function useAvailablePartners() {
  return useQuery({
    queryKey: ['partner', 'available-partners'],
    queryFn: async (): Promise<PartnerListItem[]> => {
      const { data } = await api.get<PartnerListItem[]>('/partner/available-partners');
      return data;
    },
  });
}

export function useRequestPartnerLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { partnerOrgId: string; message?: string }) => {
      await api.post('/partner/link-request', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'available-partners'] });
    },
  });
}

export function useAdminPartners() {
  return useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async (): Promise<AdminPartnerRow[]> => {
      const { data } = await api.get<AdminPartnerRow[]>('/admin/partners');
      return data;
    },
  });
}

export function useUpdatePartnerCommissionRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerOrgId,
      rate,
    }: {
      partnerOrgId: string;
      rate: number;
    }) => {
      const { data } = await api.patch<{ commissionRate: number }>(
        `/admin/partners/${encodeURIComponent(partnerOrgId)}/commission-rate`,
        { rate },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
  });
}

export function useAdminPartnerLinkRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
  return useQuery({
    queryKey: ['admin', 'partner-link-requests', status ?? 'all'],
    queryFn: async (): Promise<AdminPartnerLinkRequest[]> => {
      const { data } = await api.get<AdminPartnerLinkRequest[]>(
        '/admin/partner-link-requests',
        { params: status ? { status } : undefined },
      );
      return data;
    },
  });
}

export function usePendingPartnerLinkCount() {
  return useQuery({
    queryKey: ['admin', 'partner-link-requests', 'pending-count'],
    queryFn: async (): Promise<number> => {
      const { data } = await api.get<{ count: number }>(
        '/admin/partner-link-requests/pending-count',
      );
      return data.count;
    },
    refetchInterval: 60_000,
  });
}

export function useApprovePartnerLinkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/partner-link-requests/${encodeURIComponent(id)}/approve`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partner-link-requests'] });
      void qc.invalidateQueries({
        queryKey: ['admin', 'partner-link-requests', 'pending-count'],
      });
    },
  });
}

export function useRejectPartnerLinkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await api.post(
        `/admin/partner-link-requests/${encodeURIComponent(id)}/reject`,
        { note },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partner-link-requests'] });
      void qc.invalidateQueries({
        queryKey: ['admin', 'partner-link-requests', 'pending-count'],
      });
    },
  });
}
