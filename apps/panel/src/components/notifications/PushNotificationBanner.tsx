import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { api } from '@/lib/api';
import { patchNotificationPreferences } from '@/lib/notification-preferences';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'senkronize-push-banner-dismissed';

function isDismissedPermanently(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

interface Props {
  className?: string;
}

export function PushNotificationBanner({ className }: Props): ReactElement | null {
  const queryClient = useQueryClient();
  const { subscribe, isSupported } = usePushNotifications();
  const [dismissedSession, setDismissedSession] = useState(false);
  const [permanentDismiss, setPermanentDismiss] = useState(isDismissedPermanently);

  const pushStatusQuery = useQuery({
    queryKey: ['push-subscription-status'],
    queryFn: async (): Promise<{ subscribed: boolean }> => {
      const { data } = await api.get<{ subscribed: boolean }>('/push/status');
      return data;
    },
    staleTime: 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const ok = await subscribe();
      if (!ok) {
        throw new Error('Tarayıcı bildirim izni verilmedi.');
      }
      await patchNotificationPreferences({ pushEnabled: true });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['push-subscription-status'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setDismissedSession(true);
      toast.success('Anlık bildirimler etkinleştirildi.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Bildirimler açılamadı.';
      toast.error(msg);
    },
  });

  useEffect(() => {
    setPermanentDismiss(isDismissedPermanently());
  }, []);

  const subscribed = pushStatusQuery.data?.subscribed ?? false;
  const hidden =
    !isSupported ||
    permanentDismiss ||
    dismissedSession ||
    subscribed ||
    pushStatusQuery.isLoading;

  if (hidden) {
    return null;
  }

  const dismiss = (permanent: boolean): void => {
    if (permanent) {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
      setPermanentDismiss(true);
    }
    setDismissedSession(true);
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-sky-200 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-sky-900 dark:bg-sky-950/40',
        className,
      )}
      role="region"
      aria-label="Push bildirim daveti"
    >
      <div className="flex min-w-0 items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Anlık bildirimler için izin ver</p>
          <p className="text-xs text-muted-foreground">
            Yeni sipariş ve kritik uyarıları tarayıcı bildirimi olarak alın.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Button
          type="button"
          size="sm"
          disabled={enableMutation.isPending}
          onClick={() => enableMutation.mutate()}
        >
          İzin ver
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => dismiss(false)}
        >
          Kapat
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => dismiss(true)}
        >
          Bir daha gösterme
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 sm:ml-0"
          aria-label="Bannerı kapat"
          onClick={() => dismiss(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
