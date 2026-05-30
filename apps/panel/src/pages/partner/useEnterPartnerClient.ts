import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import { resolveOrgHomePath } from '@/lib/org-products';
import { syncAuthStoreFromMe } from '@/lib/sync-auth-from-me';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { MeResponse } from '@/types/auth';

import { usePartnerClientAccess } from './hooks/usePartner';

export function useEnterPartnerClient(): {
  enterClient: (clientOrgId: string, clientName: string) => Promise<void>;
  isPending: boolean;
  isEnteringClient: (clientOrgId: string) => boolean;
} {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);
  const stopImpersonation = useImpersonationStore((s) => s.stopImpersonation);
  const accessClient = usePartnerClientAccess();
  const [enteringClientId, setEnteringClientId] = useState<string | null>(null);

  const enterClient = useCallback(
    async (clientOrgId: string, clientName: string): Promise<void> => {
      if (enteringClientId != null || accessClient.isPending) {
        return;
      }

      setEnteringClientId(clientOrgId);
      let impersonationStarted = false;

      try {
        const { impersonationToken } =
          await accessClient.mutateAsync(clientOrgId);
        startImpersonation({ id: clientOrgId, name: clientName }, impersonationToken);
        impersonationStarted = true;

        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        const { data: me } = await api.get<MeResponse>('/auth/me');
        queryClient.setQueryData(['auth', 'me'], me);

        if (!me.isImpersonating) {
          stopImpersonation();
          toast.error(t('partner.pages.clients.enterClientFailed'));
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
      } catch (err: unknown) {
        if (impersonationStarted) {
          stopImpersonation();
          void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        }
        toast.error(getApiErrorMessage(err));
      } finally {
        setEnteringClientId(null);
      }
    },
    [
      accessClient,
      enteringClientId,
      navigate,
      queryClient,
      startImpersonation,
      stopImpersonation,
      t,
    ],
  );

  const isEnteringClient = useCallback(
    (clientOrgId: string): boolean => enteringClientId === clientOrgId,
    [enteringClientId],
  );

  return {
    enterClient,
    isPending: accessClient.isPending || enteringClientId != null,
    isEnteringClient,
  };
}
