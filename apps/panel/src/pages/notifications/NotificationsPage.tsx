import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotificationsPage,
  markNotificationRead,
  type InAppNotificationListFilter,
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

const FILTER_OPTIONS: { value: InAppNotificationListFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'unread', label: 'Okunmamış' },
  { value: 'order', label: 'Sipariş' },
  { value: 'stock', label: 'Stok' },
  { value: 'error', label: 'Hata' },
];

export function NotificationsPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InAppNotificationListFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const markAsReadLocal = useNotificationsStore((s) => s.markAsRead);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotification);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications-page', page, filter],
    queryFn: () => fetchNotificationsPage({ page, limit, filter }),
  });

  const totalPages = useMemo(() => {
    if (!data?.total) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.total / limit));
  }, [data?.total, limit]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: (_void, id) => {
      removeNotificationLocal(id);
      void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      toast.success('Bildirim silindi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => deleteAllNotifications(),
    onSuccess: (deleted) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      useNotificationsStore.getState().clearLocal();
      toast.success(`${String(deleted)} bildirim kaldırıldı`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_void, id) => {
      markAsReadLocal(id);
      void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleRowActivate = (n: InAppNotification): void => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    if (n.link && n.link.startsWith('/')) {
      navigate(n.link);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bildirimler
          </h1>
          <p className="text-sm text-muted-foreground">
            Sipariş, stok ve senkronizasyon bildirimlerinizi yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as InAppNotificationListFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtre" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={clearAllMutation.isPending || !data?.total}
              >
                Tümünü temizle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tüm bildirimleri sil?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu işlem geri alınamaz. Organizasyonunuz için size görünen tüm bildirimler
                  silinecektir.
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
                  Sil
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Liste yüklenemedi</p>
          <p className="mt-1 text-muted-foreground">{getApiErrorMessage(error)}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void refetch()}>
            Yeniden dene
          </Button>
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium text-foreground">Henüz bildirim yok</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Yeni sipariş veya uyarılar burada listelenir.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {data.data.map((n) => (
              <li
                key={n.id}
                className={cn(
                  'flex gap-3 p-4 transition-colors',
                  !n.isRead && 'border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/25',
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 gap-3 text-left"
                  onClick={() => handleRowActivate(n)}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {typeEmoji(n.type)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={cn(
                        'text-sm text-foreground',
                        !n.isRead ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: tr,
                      })}
                    </p>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Bildirimi sil"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(n.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Toplam {data.total} kayıt · Sayfa {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
