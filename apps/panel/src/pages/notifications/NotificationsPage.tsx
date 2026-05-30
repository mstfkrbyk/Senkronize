import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import {
  CategoryIcon,
  categoryStyles,
  visualCategoryForType,
} from '@/components/notifications/notification-utils';
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
  buildNotificationFilterOptions,
  NOTIFICATION_PRODUCT_CATEGORY_OPTIONS,
  notificationsPageSubtitle,
  resolveNotificationListScope,
  showNotificationProductCategoryChips,
  type InAppNotificationProductCategory,
} from '@/lib/in-app-notification-categories';
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
  useNotificationsStore,
} from '@/store/notifications.store';
import { useAuthStore } from '@/store/auth.store';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { toast } from 'sonner';

export function NotificationsPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.notifications'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const showProductChips = showNotificationProductCategoryChips(orgProducts);
  const filterOptions = useMemo(
    () => buildNotificationFilterOptions(orgProducts),
    [orgProducts],
  );

  const [productCategory, setProductCategory] =
    useState<InAppNotificationProductCategory>('all');
  const [filter, setFilter] = useState<InAppNotificationListFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const markAsReadLocal = useNotificationsStore((s) => s.markAsRead);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotification);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  const listScope = useMemo(
    () => resolveNotificationListScope(orgProducts, productCategory),
    [orgProducts, productCategory],
  );

  const subtitle = useMemo(
    () => notificationsPageSubtitle(orgProducts),
    [orgProducts],
  );

  useEffect(() => {
    if (!filterOptions.some((o) => o.value === filter)) {
      setFilter('all');
      setPage(1);
    }
  }, [filter, filterOptions]);

  usePageTitle(t('nav.notifications'), { badgeCount: unreadCount });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications-page', page, filter, listScope],
    queryFn: () =>
      fetchNotificationsPage({
        page,
        limit,
        filter,
        scope: listScope,
      }),
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
      <PageHeader
        title={t('nav.notifications')}
        description={subtitle}
        context={navContextLine}
        actions={
          <div className="flex flex-col gap-2 sm:items-end">
            {showProductChips ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Bildirim kategorisi"
              >
                {NOTIFICATION_PRODUCT_CATEGORY_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={productCategory === o.value ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => {
                      setProductCategory(o.value);
                      setPage(1);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            ) : null}
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
                {filterOptions.map((o) => (
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
                    Bu işlem geri alınamaz. Organizasyonunuz için size görünen tüm
                    bildirimler silinecektir.
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
        }
      />

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
        <EmptyState
          icon={Bell}
          title="Bildirim yok"
          description={
            filter === 'unread'
              ? 'Okunmamış bildiriminiz bulunmuyor.'
              : 'Yeni bildirimler burada görünecek.'
          }
        />
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {data.data.map((n) => {
              const visualCategory = visualCategoryForType(n.type);
              const styles = categoryStyles(visualCategory);
              return (
                <li
                  key={n.id}
                  className={cn(
                    'flex gap-3 p-4 transition-colors',
                    !n.isRead && `border-l-4 ${styles.unreadBorder}`,
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 gap-3 text-left"
                    onClick={() => handleRowActivate(n)}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        styles.iconBg,
                        styles.iconText,
                      )}
                      aria-hidden
                    >
                      <CategoryIcon category={visualCategory} />
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
              );
            })}
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
