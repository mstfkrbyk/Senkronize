import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import { resolveOrgHomePath } from '@/lib/org-products';
import { syncAuthStoreFromMe } from '@/lib/sync-auth-from-me';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { MeResponse } from '@/types/auth';

function extractImpersonationToken(data: unknown): string | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }
  const r = data as Record<string, unknown>;
  if (typeof r.token === 'string' && r.token.length > 0) {
    return r.token;
  }
  if (
    typeof r.impersonationToken === 'string' &&
    r.impersonationToken.length > 0
  ) {
    return r.impersonationToken;
  }
  return null;
}

export function useEnterAdminOrg(): {
  enterOrg: (orgId: string, orgName: string) => Promise<void>;
  isPending: boolean;
  isEnteringOrg: (orgId: string) => boolean;
} {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);
  const stopImpersonation = useImpersonationStore((s) => s.stopImpersonation);
  const [enteringOrgId, setEnteringOrgId] = useState<string | null>(null);

  const impersonateMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data: res } = await api.post<unknown>(
        `/admin/organizations/${orgId}/impersonate`,
      );
      const token = extractImpersonationToken(res);
      if (!token) {
        throw new Error(t('admin.organizations.enterOrg.invalidSession'));
      }
      return token;
    },
  });

  const enterOrg = useCallback(
    async (orgId: string, orgName: string): Promise<void> => {
      if (enteringOrgId != null || impersonateMutation.isPending) {
        return;
      }

      setEnteringOrgId(orgId);
      let impersonationStarted = false;

      try {
        const token = await impersonateMutation.mutateAsync(orgId);
        startImpersonation({ id: orgId, name: orgName }, token);
        impersonationStarted = true;

        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        const { data: me } = await api.get<MeResponse>('/auth/me');
        queryClient.setQueryData(['auth', 'me'], me);

        if (!me.isImpersonating) {
          stopImpersonation();
          toast.error(t('admin.organizations.enterOrg.failed'));
          return;
        }

        syncAuthStoreFromMe(me);
        navigate(
          resolveOrgHomePath(
            me.organization.orgProducts,
            undefined,
            me.organization.accountingMode,
          ),
        );
        toast.success(t('admin.organizations.enterOrg.redirecting'));
      } catch (err: unknown) {
        if (impersonationStarted) {
          stopImpersonation();
          void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        }
        toast.error(getApiErrorMessage(err));
      } finally {
        setEnteringOrgId(null);
      }
    },
    [
      enteringOrgId,
      impersonateMutation,
      navigate,
      queryClient,
      startImpersonation,
      stopImpersonation,
      t,
    ],
  );

  const isEnteringOrg = useCallback(
    (orgId: string): boolean => enteringOrgId === orgId,
    [enteringOrgId],
  );

  return {
    enterOrg,
    isPending: impersonateMutation.isPending || enteringOrgId != null,
    isEnteringOrg,
  };
}
