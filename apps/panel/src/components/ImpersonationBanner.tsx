import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage, api } from '@/lib/api';
import { useImpersonationStore } from '@/store/impersonation.store';

export function ImpersonationBanner(): ReactElement | null {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  const impersonatedOrg = useImpersonationStore((s) => s.impersonatedOrg);
  const stopLocal = useImpersonationStore((s) => s.stopImpersonation);

  const stopMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/impersonation/stop');
    },
    onSuccess: () => {
      stopLocal();
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/partner');
      toast.success('Kendi hesabınıza döndünüz.');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  if (!isImpersonating || !impersonatedOrg) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-white">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ArrowLeftRight className="size-5 shrink-0" aria-hidden />
        <span className="truncate text-sm">
          Şu an <strong>{impersonatedOrg.name}</strong> hesabında çalışıyorsunuz
        </span>
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
