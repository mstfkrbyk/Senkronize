import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { PartnerClientBadges } from '@/components/PartnerClientBadges';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage, api } from '@/lib/api';
import { syncAuthStoreFromMe } from '@/lib/sync-auth-from-me';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { MeResponse } from '@/types/auth';

export function ImpersonationBanner(): ReactElement | null {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  const impersonatedOrg = useImpersonationStore((s) => s.impersonatedOrg);
  const stopLocal = useImpersonationStore((s) => s.stopImpersonation);

  const isSuperAdmin = me?.user.role === 'SUPER_ADMIN';
  const exitPath = isSuperAdmin ? '/admin/organizations' : '/partner';

  const stopMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!impersonatedOrg) {
        return;
      }
      if (!isSuperAdmin) {
        await api.post('/impersonation/stop', {
          clientOrgId: impersonatedOrg.id,
        });
      }
    },
    onSuccess: async () => {
      stopLocal();
      try {
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        const { data: refreshedMe } = await api.get<MeResponse>('/auth/me');
        queryClient.setQueryData(['auth', 'me'], refreshedMe);
        syncAuthStoreFromMe(refreshedMe);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error));
      }
      navigate(exitPath);
      toast.success(
        isSuperAdmin
          ? 'Admin paneline döndünüz.'
          : 'Kendi hesabınıza döndünüz.',
      );
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  if (!isImpersonating || !impersonatedOrg) {
    return null;
  }

  const orgName = impersonatedOrg.name || me?.organization.name || 'Müşteri';
  const orgProducts = me?.organization.orgProducts;
  const accountingMode = me?.organization.accountingMode;

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <ArrowLeftRight className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-sm">
          <strong className="font-semibold">{orgName}</strong>
          <span className="font-normal opacity-90"> — müşteri hesabı</span>
        </span>
        <PartnerClientBadges
          orgProducts={orgProducts}
          accountingMode={accountingMode}
          variant="compact"
          appearance="inverse"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-white bg-transparent text-white hover:bg-white/15 hover:text-white"
        disabled={stopMutation.isPending}
        onClick={() => stopMutation.mutate()}
      >
        {stopMutation.isPending ? 'Geri dönülüyor…' : 'Kendi Hesabıma Dön'}
      </Button>
    </div>
  );
}
