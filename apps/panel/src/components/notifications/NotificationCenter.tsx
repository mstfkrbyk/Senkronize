import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Loader2, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { NotificationCard } from '@/components/notifications/NotificationCard';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotificationsPage,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type InAppNotificationListFilter,
} from '@/lib/in-app-notifications-api';
import { cn } from '@/lib/utils';
import {
  type InAppNotification,
  useNotificationsStore,
} from '@/store/notifications.store';

const PAGE_SIZE = 15;

type CenterTab = 'unread' | 'all';

interface Props {
  className?: string;
}

export function NotificationCenter({ className }: Props): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOpen = useNotificationsStore((s) => s.isOpen);
  const setOpen = useNotificationsStore((s) => s.setOpen);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const markAsReadLocal = useNotificationsStore((s) => s.markAsRead);
  const markAllAsReadLocal = useNotificationsStore((s) => s.markAllAsRead);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotification);
  const clearLocal = useNotificationsStore((s) => s.clearLocal);

  const [tab, setTab] = useState<CenterTab>('unread');
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<InAppNotification[]>([]);

  const filter: InAppNotificationListFilter = tab === 'unread' ? 'unread' : 'all';

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

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['notifications-center', tab, page],
    queryFn: () => fetchNotificationsPage({ page, limit: PAGE_SIZE, filter }),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPage(1);
    setAccumulated([]);
  }, [tab, isOpen]);

  useEffect(() => {
    if (!data?.data) {
      return;
    }
    setAccumulated((prev) => {
      if (page === 1) {
        return data.data;
      }
      const ids = new Set(prev.map((n) => n.id));
      const merged = [...prev];
      for (const n of data.data) {
        if (!ids.has(n.id)) {
          merged.push(n);
        }
      }
      return merged;
    });
  }, [data, page]);

  const hasMore = useMemo(() => {
    if (!data) {
      return false;
    }
    return accumulated.length < data.total;
  }, [accumulated.length, data]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_void, id) => {
      markAsReadLocal(id);
      void invalidateNotificationQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      markAllAsReadLocal();
      void invalidateNotificationQueries(queryClient);
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: (_void, id) => {
      removeNotificationLocal(id);
      setAccumulated((prev) => prev.filter((n) => n.id !== id));
      void invalidateNotificationQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => deleteAllNotifications(),
    onSuccess: (deleted) => {
      clearLocal();
      setAccumulated([]);
      setPage(1);
      void invalidateNotificationQueries(queryClient);
      toast.success(`${String(deleted)} bildirim temizlendi`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleOpenChange = useCallback(
    (open: boolean): void => {
      setOpen(open);
      if (!open) {
        setPage(1);
        setAccumulated([]);
      }
    },
    [setOpen],
  );

  const handleActivate = useCallback(
    (n: InAppNotification): void => {
      if (!n.isRead) {
        markReadMutation.mutate(n.id);
      }
      if (n.link && n.link.startsWith('/')) {
        navigate(n.link);
        setOpen(false);
      }
    },
    [markReadMutation, navigate, setOpen],
  );

  const loadMore = (): void => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1);
    }
  };

  const badgeCount = unreadCount;
  const listEmpty = !isFetching && accumulated.length === 0;

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
              className={cn(
                'absolute -right-0.5 -top-0.5 flex size-5 animate-pulse items-center justify-center rounded-full p-0 text-[10px] shadow-sm ring-2 ring-background',
              )}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(26rem,calc(100vw-2rem))] p-0"
        sideOffset={8}
      >
        <div className="flex max-h-[min(32rem,80vh)] flex-col">
          <div className="shrink-0 space-y-2 border-b border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Bildirim merkezi</p>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link
                  to="/settings/notifications"
                  aria-label="Bildirim tercihleri"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="size-4" />
                </Link>
              </Button>
            </div>
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as CenterTab)}
              className="w-full"
            >
              <TabsList className="grid h-8 w-full grid-cols-2">
                <TabsTrigger value="unread" className="text-xs">
                  Okunmamış
                  {badgeCount > 0 ? (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  Tümü
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={badgeCount === 0 || markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
              >
                Tümünü okundu işaretle
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    disabled={clearAllMutation.isPending || listEmpty}
                  >
                    Tüm bildirimleri temizle
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tüm bildirimleri sil?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bu işlem geri alınamaz. Tüm bildirimleriniz kalıcı olarak kaldırılır.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={clearAllMutation.isPending}
                      onClick={() => clearAllMutation.mutate()}
                    >
                      Temizle
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {isError ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-destructive">Yüklenemedi</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getApiErrorMessage(error)}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void refetch()}
                >
                  Yeniden dene
                </Button>
              </div>
            ) : listEmpty && isFetching ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Yükleniyor…
              </div>
            ) : listEmpty ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <BellOff className="size-7 text-muted-foreground" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">
                  {tab === 'unread' ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sipariş, stok, senkronizasyon ve sistem mesajları burada görünecek.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {accumulated.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    compact
                    onActivate={handleActivate}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                    deletePending={deleteMutation.isPending}
                    markReadPending={markReadMutation.isPending}
                  />
                ))}
              </ul>
            )}
            {hasMore && !listEmpty ? (
              <div className="border-t border-border px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs"
                  disabled={isFetching}
                  onClick={loadMore}
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Yükleniyor…
                    </>
                  ) : (
                    'Daha fazla yükle'
                  )}
                </Button>
              </div>
            ) : null}
          </ScrollArea>

          <Separator />
          <div className="shrink-0 px-3 py-2">
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

function invalidateNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
}
