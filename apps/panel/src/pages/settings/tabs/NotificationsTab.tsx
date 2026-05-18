import type { ReactElement } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

interface NotificationPrefs {
  id: string;
  organizationId: string;
  userId: string;
  newOrder: boolean;
  stockAlert: boolean;
  paymentAlert: boolean;
  syncError: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type PrefToggleKey =
  | 'newOrder'
  | 'stockAlert'
  | 'paymentAlert'
  | 'syncError'
  | 'emailEnabled'
  | 'smsEnabled'
  | 'pushEnabled';

export function NotificationsTab(): ReactElement {
  const queryClient = useQueryClient();

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data } = await api.get<NotificationPrefs>(
        '/users/notification-preferences',
      );
      return data;
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (body: Partial<Pick<NotificationPrefs, PrefToggleKey>>) =>
      api
        .patch<NotificationPrefs>('/users/notification-preferences', body)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-preferences'],
      });
    },
    onError: () => {
      toast.error('Kaydedilemedi. Lütfen tekrar deneyin.');
    },
  });

  const prefs = prefsQuery.data;
  const busy = prefsQuery.isLoading || updatePrefs.isPending;

  const setPref = (key: PrefToggleKey, value: boolean): void => {
    updatePrefs.mutate({ [key]: value });
  };

  if (prefsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Bildirim tercihleri yüklenemedi. Sayfayı yenileyin.
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-lg font-medium text-primary">Bildirim tercihleri</h3>
        <p className="text-sm text-muted-foreground">
          Hangi olaylar için uyarı almak istediğinizi ve hangi kanalları
          kullanacağınızı seçin.
        </p>
      </div>

      {prefsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {prefs ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium text-primary">Olaylar</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-new-order">Yeni sipariş</Label>
              <Switch
                id="n-new-order"
                checked={prefs.newOrder}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('newOrder', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-stock">Stok uyarısı</Label>
              <Switch
                id="n-stock"
                checked={prefs.stockAlert}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('stockAlert', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-pay">Ödeme bildirimi</Label>
              <Switch
                id="n-pay"
                checked={prefs.paymentAlert}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('paymentAlert', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-sync">Senkron hatası</Label>
              <Switch
                id="n-sync"
                checked={prefs.syncError}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('syncError', v);
                }}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium text-primary">Kanallar</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-email">E-posta</Label>
              <Switch
                id="n-email"
                checked={prefs.emailEnabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('emailEnabled', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="n-sms">SMS</Label>
                <Badge variant="secondary" className="text-xs">
                  Beta
                </Badge>
              </div>
              <Switch
                id="n-sms"
                checked={prefs.smsEnabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('smsEnabled', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="n-push">Push</Label>
                <Badge variant="secondary" className="text-xs">
                  Beta
                </Badge>
              </div>
              <Switch
                id="n-push"
                checked={prefs.pushEnabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setPref('pushEnabled', v);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
