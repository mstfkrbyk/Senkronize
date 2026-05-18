import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type {
  ClientOnboardingRow,
  CommissionReport,
  CommissionSummary,
  PartnerCommissionsPage,
  PartnerDashboard,
  PartnerPerformance,
  PartnerRelationship,
} from '@/types/partner';

export function useMyClients() {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'clients'],
    queryFn: async (): Promise<PartnerRelationship[]> => {
      const { data } = await api.get<PartnerRelationship[]>('/partner/clients');
      return data;
    },
    enabled: orgType === 'PARTNER',
  });
}

export function useCommissionSummary() {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'commission'],
    queryFn: async (): Promise<CommissionSummary> => {
      const { data } = await api.get<CommissionSummary>('/partner/commission');
      return data;
    },
    enabled: orgType === 'PARTNER',
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
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'invites'],
    queryFn: async (): Promise<ClientOnboardingRow[]> => {
      const { data } = await api.get<ClientOnboardingRow[]>('/partner/invites');
      return data;
    },
    enabled: orgType === 'PARTNER',
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
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'commission-report', year, month],
    queryFn: async (): Promise<CommissionReport> => {
      const { data } = await api.get<CommissionReport>('/partner/commission-report', {
        params: { year, month },
      });
      return data;
    },
    enabled: orgType === 'PARTNER',
  });
}

export function usePartnerPerformance() {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'performance'],
    queryFn: async (): Promise<PartnerPerformance> => {
      const { data } = await api.get<PartnerPerformance>('/partner/performance');
      return data;
    },
    enabled: orgType === 'PARTNER',
  });
}

export function usePayoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number): Promise<void> => {
      await api.post('/partner/payout-request', { amount });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partner', 'commission'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'commission-report'] });
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
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'dashboard'],
    queryFn: async (): Promise<PartnerDashboard> => {
      const { data } = await api.get<PartnerDashboard>('/partner/dashboard');
      return data;
    },
    enabled: orgType === 'PARTNER',
  });
}

export function usePartnerCommissions(page: number, limit: number) {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'commissions', page, limit],
    queryFn: async (): Promise<PartnerCommissionsPage> => {
      const { data } = await api.get<PartnerCommissionsPage>(
        '/partner/commissions',
        { params: { page, limit } },
      );
      return data;
    },
    enabled: orgType === 'PARTNER',
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

export function useMyPartners() {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  return useQuery({
    queryKey: ['partner', 'my-partners'],
    queryFn: async (): Promise<PartnerRelationship[]> => {
      const { data } = await api.get<PartnerRelationship[]>(
        '/partner/my-partners',
      );
      return data;
    },
    enabled: Boolean(orgType) && orgType !== 'PARTNER',
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
