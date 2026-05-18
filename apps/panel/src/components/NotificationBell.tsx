import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  fetchNotificationsPage,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/in-app-notifications-api';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  type InAppNotification,
  type InAppNotificationType,
  useNotificationsStore,
} from '@/store/notifications.store';
import { toast } from 'sonner';

function typeEmoji(type: InAppNotificationType): string {
  switch (type) {
    case 'ORDER_NEW':
    case 'ORDER_STATUS_CHANGED':
      return '🛒';
    case 'STOCK_LOW':
    case 'STOCK_OUT':
      return '📦';
    case 'SYNC_ERROR':
    case 'PAYMENT_FAILED':
      return '⚠️';
    case 'SYNC_SUCCESS':
      return '✅';
    case 'PRICE_UPDATED':
    case 'BUYBOX_WON':
    case 'BUYBOX_LOST':
      return '💰';
    default:
      return '🔔';
  }
}

interface Props {
  /** Mobilde tetikleyici için ek sınıflar */
  className?: string;
}

export function NotificationBell({ className }: Props): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOpen = useNotificationsStore((s) => s.isOpen);
  const setOpen = useNotificationsStore((s) => s.setOpen);
  const notifications = useNotificationsStore((s) => s.notifications);
  const setNotifications = useNotificationsStore((s) => s.setNotifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const markAsReadLocal = useNotificationsStore((s) => s.markAsRead);
  const markAllAsReadLocal = useNotificationsStore((s) => s.markAllAsRead);

  const { data: serverUnread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (typeof serverUnread === 'number') {
      setUnreadCount(serverUnread);
    }
  }, [serverUnread, setUnreadCount]);

  const { data: preview, isFetching } = useQuery({
    queryKey: ['notifications-preview'],
    queryFn: () => fetchNotificationsPage({ page: 1, limit: 15, filter: 'all' }),
    enabled: isOpen,
  });

  useEffect(() => {
    if (preview?.data) {
      setNotifications(preview.data);
    }
  }, [preview, setNotifications]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_void, id) => {
      markAsReadLocal(id);
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      markAllAsReadLocal();
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleOpenChange = (open: boolean): void => {
    setOpen(open);
  };

  const handleRowClick = (n: InAppNotification): void => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    if (n.link && n.link.startsWith('/')) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const displayList = notifications.length > 0 ? notifications : (preview?.data ?? []);
  const badgeCount = unreadCount;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('relative shrink-0', className)}
          aria-label="Bildirimler"
        >
          <Bell className="size-5" />
          {badgeCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0" sideOffset={8}>
        <div className="flex max-h-96 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Bildirimler</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={badgeCount === 0 || markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Tümünü okundu işaretle
            </Button>
          </div>
          <ScrollArea className="max-h-96">
            {isFetching && displayList.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Yükleniyor…
              </p>
            ) : displayList.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">Henüz bildirim yok</p>
                <p className="text-xs text-muted-foreground">
                  Sipariş, stok ve senkronizasyon güncellemeleri burada görünecek.
                </p>
              </div>
            ) : (
              <ul className="divide-y p-0">
                {displayList.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60',
                        !n.isRead && 'border-l-4 border-l-sky-500 bg-sky-50/50 dark:bg-sky-950/20',
                      )}
                      onClick={() => handleRowClick(n)}
                    >
                      <span className="pt-0.5 text-lg leading-none" aria-hidden>
                        {typeEmoji(n.type)}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          className={cn(
                            'text-sm leading-tight text-foreground',
                            !n.isRead && 'font-semibold',
                          )}
                        >
                          {n.title}
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: tr,
                          })}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <div className="border-t px-3 py-2">
            <Button variant="link" className="h-auto w-full p-0 text-sm" asChild>
              <Link to="/notifications" onClick={() => setOpen(false)}>
                Tüm bildirimleri gör
              </Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
