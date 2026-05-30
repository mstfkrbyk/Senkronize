import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  normalizeClientOnboardingInvites,
  normalizeCommissionReport,
  normalizeCommissionSummary,
  normalizePartnerCommissionsPage,
  normalizePartnerDashboard,
  normalizePartnerPayoutRequest,
  normalizePartnerPayoutRequests,
  normalizePartnerPerformance,
  normalizePartnerRelationships,
} from '@/lib/partner-api-normalize';
import { useAuthStore } from '@/store/auth.store';
import { useImpersonationStore } from '@/store/impersonation.store';
import type {
  ClientOnboardingRow,
  CommissionReport,
  CommissionSummary,
  PartnerCommissionsPage,
  PartnerDashboard,
  PartnerPayoutRequest,
  PartnerPerformance,
  PartnerRelationship,
} from '@/types/partner';

import {
  isClientPartnerQueriesEnabled,
  isPartnerQueriesEnabled,
} from './partner-query-enabled';

/**
 * Partner API query `enabled` — bkz. `isPartnerQueriesEnabled`.
 *
 * Manuel regresyon (panel'de vitest yok):
 * 1. PARTNER org ile giriş → partner sayfaları veri yükler (/partner/* istekleri gider).
 * 2. Sayfa yenile (F5) → store `currentOrg.type` DIRECT kalsa bile /me PARTNER ise sorgular enabled kalır.
 * 3. /me yüklenirken (`isPending`) → partner API isteği atılmaz.
 * 4. DIRECT org → partner hook'ları disabled; ağda /partner/* yok.
 */
export function usePartnerQueriesEnabled(): boolean {
  const { data: me, isPending } = useAuth();
  const storeType = useAuthStore((s) => s.currentOrg?.type);
  return isPartnerQueriesEnabled({
    isMePending: isPending,
    meOrgType: me?.organization?.type,
    storeOrgType: storeType,
  });
}

export function useMyClients() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'clients'],
    queryFn: async (): Promise<PartnerRelationship[]> => {
      const { data } = await api.get<PartnerRelationship[]>('/partner/clients');
      return normalizePartnerRelationships(data);
    },
    enabled,
  });
}

export function useCommissionSummary() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'commission'],
    queryFn: async (): Promise<CommissionSummary> => {
      const { data } = await api.get<CommissionSummary>('/partner/commission');
      return normalizeCommissionSummary(data);
    },
    enabled,
  });
}

export function useInviteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      clientEmail: string;
      commissionPct?: number;
      canImpersonate?: boolean;
    }): Promise<{ inviteUrl: string }> => {
      const { data } = await api.post<{ inviteUrl: string }>(
        '/partner/clients/invite',
        body,
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'clients'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'commissions'] });
    },
  });
}

export function usePartnerOnboardingInvites() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'invites'],
    queryFn: async (): Promise<ClientOnboardingRow[]> => {
      const { data } = await api.get<ClientOnboardingRow[]>('/partner/invites');
      return normalizeClientOnboardingInvites(data);
    },
    enabled,
  });
}

export function useCreateOnboardingInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      email: string;
      message?: string;
    }): Promise<{ inviteUrl: string } & Record<string, unknown>> => {
      const { data } = await api.post('/partner/invite', body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'invites'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'dashboard'] });
    },
  });
}

export function useResendOnboardingInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ inviteUrl: string }> => {
      const { data } = await api.post<{ inviteUrl: string }>(
        `/partner/invites/${encodeURIComponent(id)}/resend`,
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'invites'] });
    },
  });
}

export function useCommissionReport(year: number, month: number) {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'commission-report', year, month],
    queryFn: async (): Promise<CommissionReport> => {
      const { data } = await api.get<CommissionReport>('/partner/commission-report', {
        params: { year, month },
      });
      return normalizeCommissionReport(data);
    },
    enabled,
  });
}

export function usePartnerPerformance() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'performance'],
    queryFn: async (): Promise<PartnerPerformance> => {
      const { data } = await api.get<PartnerPerformance>('/partner/performance');
      return normalizePartnerPerformance(data);
    },
    enabled,
  });
}

export function usePartnerPayoutRequests() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'payout-requests'],
    queryFn: async (): Promise<PartnerPayoutRequest[]> => {
      const { data } = await api.get<PartnerPayoutRequest[]>('/partner/payout-requests');
      return normalizePartnerPayoutRequests(data);
    },
    enabled,
  });
}

export function usePayoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number): Promise<PartnerPayoutRequest> => {
      const { data } = await api.post<PartnerPayoutRequest>('/partner/payout-request', {
        amount,
      });
      const row = normalizePartnerPayoutRequest(data);
      if (!row) {
        throw new Error('Geçersiz ödeme talebi yanıtı');
      }
      return row;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'commission'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'commission-report'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'payout-requests'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'commissions'] });
    },
  });
}

export function useValidatePartnerInvite(token: string | null) {
  return useQuery({
    queryKey: ['partner', 'validate-invite', token],
    queryFn: async (): Promise<{
      partnerOrgId: string;
      email: string;
      partnerName: string;
    }> => {
      const { data } = await api.post<{
        partnerOrgId: string;
        email: string;
        partnerName: string;
      }>('/partner/validate-invite', { token: token ?? '' });
      return data;
    },
    enabled: Boolean(token && token.length >= 10),
  });
}

export function usePartnerDashboard() {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'dashboard'],
    queryFn: async (): Promise<PartnerDashboard> => {
      const { data } = await api.get<PartnerDashboard>('/partner/dashboard');
      return normalizePartnerDashboard(data);
    },
    enabled,
  });
}

export function usePartnerCommissions(page: number, limit: number) {
  const enabled = usePartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'commissions', page, limit],
    queryFn: async (): Promise<PartnerCommissionsPage> => {
      const { data } = await api.get<PartnerCommissionsPage>(
        '/partner/commissions',
        { params: { page, limit } },
      );
      return normalizePartnerCommissionsPage(data);
    },
    enabled,
  });
}

export function usePartnerClientAccess() {
  return useMutation({
    mutationFn: async (
      clientOrgId: string,
    ): Promise<{ impersonationToken: string; expiresIn: number }> => {
      const { data } = await api.post<{
        impersonationToken: string;
        expiresIn: number;
      }>(`/partner/clients/${clientOrgId}/access`);
      return data;
    },
  });
}

export function useTerminateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/partner/clients/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'clients'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'commissions'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useClientPartnerQueriesEnabled(): boolean {
  const { data: me, isPending } = useAuth();
  const storeType = useAuthStore((s) => s.currentOrg?.type);
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  return isClientPartnerQueriesEnabled({
    isMePending: isPending,
    meOrgType: me?.organization?.type,
    storeOrgType: storeType,
    isImpersonating: isImpersonating || Boolean(me?.isImpersonating),
  });
}

export function useMyPartners() {
  const enabled = useClientPartnerQueriesEnabled();
  return useQuery({
    queryKey: ['partner', 'my-partners'],
    queryFn: async (): Promise<PartnerRelationship[]> => {
      const { data } = await api.get<PartnerRelationship[]>(
        '/partner/my-partners',
      );
      return normalizePartnerRelationships(data);
    },
    enabled,
  });
}

export function useAcceptPartnerInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<void> => {
      await api.post('/partner/accept-invite', { inviteToken: token });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'my-partners'] });
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Partner ilişkisi kuruldu.');
    },
  });
}

export function useLeavePartnerRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relationshipId: string): Promise<void> => {
      await api.delete(`/partner/my-partners/${relationshipId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'my-partners'] });
      toast.success('İlişki sonlandırıldı.');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
