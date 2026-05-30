import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  normalizeAdminPartnerLinkRequestsList,
  normalizeAdminPartnerPayoutRequest,
  normalizeAdminPartnerPayoutRequests,
  normalizeAdminPartnersList,
} from '@/lib/admin-api-normalize';
import { api } from '@/lib/api';
import {
  normalizeClientPartnerLinkRequests,
  normalizePartnerIncomingLinkRequests,
  normalizePartnerListItems,
} from '@/lib/partner-api-normalize';
import type {
  AdminPartnerLinkRequest,
  AdminPartnerPayoutRequest,
  AdminPartnerPayoutStatus,
  AdminPartnerRow,
} from '@/types/admin';
import type {
  ClientPartnerLinkRequest,
  PartnerIncomingLinkRequest,
  PartnerListItem,
} from '@/types/partner';

import {
  useClientPartnerQueriesEnabled,
  usePartnerQueriesEnabled,
} from './usePartner';

export function useAvailablePartners() {
  const enabled = useClientPartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'available-partners'],
    queryFn: async (): Promise<PartnerListItem[]> => {
      const { data } = await api.get<PartnerListItem[]>('/partner/available-partners');
      return normalizePartnerListItems(data);
    },
    enabled,
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
      void qc.invalidateQueries({ queryKey: ['partner', 'my-link-requests'] });
    },
  });
}

export function useClientPartnerLinkRequests() {
  const enabled = useClientPartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'my-link-requests'],
    queryFn: async (): Promise<ClientPartnerLinkRequest[]> => {
      const { data } = await api.get<ClientPartnerLinkRequest[]>(
        '/partner/my-link-requests',
      );
      return normalizeClientPartnerLinkRequests(data);
    },
    enabled,
  });
}

export function usePartnerIncomingLinkRequests() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'incoming-link-requests'],
    queryFn: async (): Promise<PartnerIncomingLinkRequest[]> => {
      const { data } = await api.get<PartnerIncomingLinkRequest[]>(
        '/partner/incoming-link-requests',
      );
      return normalizePartnerIncomingLinkRequests(data);
    },
    enabled,
  });
}

function invalidateAdminPartnerLinkQueries(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['admin', 'partner-link-requests'] });
  void qc.invalidateQueries({
    queryKey: ['admin', 'partner-link-requests', 'pending-count'],
  });
  void qc.invalidateQueries({ queryKey: ['admin', 'partners'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
}

function invalidateAdminPartnerPayoutQueries(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['admin', 'partner-payout-requests'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'partners'] });
}

export function useAdminPartners() {
  return useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async (): Promise<AdminPartnerRow[]> => {
      const { data } = await api.get<AdminPartnerRow[]>('/admin/partners');
      return normalizeAdminPartnersList(data);
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
      return normalizeAdminPartnerLinkRequestsList(data);
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
      invalidateAdminPartnerLinkQueries(qc);
    },
  });
}

export function useAdminPartnerPayoutRequests(status?: AdminPartnerPayoutStatus) {
  return useQuery({
    queryKey: ['admin', 'partner-payout-requests', status ?? 'all'],
    queryFn: async (): Promise<AdminPartnerPayoutRequest[]> => {
      const { data } = await api.get<AdminPartnerPayoutRequest[]>(
        '/admin/partner-payout-requests',
        { params: status ? { status } : undefined },
      );
      return normalizeAdminPartnerPayoutRequests(data);
    },
  });
}

export function useApproveAdminPartnerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<AdminPartnerPayoutRequest> => {
      const { data } = await api.post<AdminPartnerPayoutRequest>(
        `/admin/partner-payout-requests/${encodeURIComponent(id)}/approve`,
      );
      const row = normalizeAdminPartnerPayoutRequest(data);
      if (!row) {
        throw new Error('Geçersiz ödeme talebi yanıtı');
      }
      return row;
    },
    onSuccess: () => {
      invalidateAdminPartnerPayoutQueries(qc);
    },
  });
}

export function useRejectAdminPartnerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      note,
    }: {
      id: string;
      note?: string;
    }): Promise<AdminPartnerPayoutRequest> => {
      const { data } = await api.post<AdminPartnerPayoutRequest>(
        `/admin/partner-payout-requests/${encodeURIComponent(id)}/reject`,
        { note },
      );
      const row = normalizeAdminPartnerPayoutRequest(data);
      if (!row) {
        throw new Error('Geçersiz ödeme talebi yanıtı');
      }
      return row;
    },
    onSuccess: () => {
      invalidateAdminPartnerPayoutQueries(qc);
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
      invalidateAdminPartnerLinkQueries(qc);
    },
  });
}
