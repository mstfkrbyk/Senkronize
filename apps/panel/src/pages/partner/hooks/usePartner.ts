import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type {
  CommissionSummary,
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
    },
  });
}

export function useStartImpersonation() {
  return useMutation({
    mutationFn: async (
      clientOrgId: string,
    ): Promise<{ impersonationToken: string }> => {
      const { data } = await api.post<{ impersonationToken: string }>(
        '/impersonation/start',
        { clientOrgId },
      );
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
      await api.post('/partner/accept-invite', { token });
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
