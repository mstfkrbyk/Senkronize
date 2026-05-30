import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, FileText, Mail, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { api } from '@/lib/api';

interface NotificationPrefs {
  id: string;
  organizationId: string;
  userId: string;
  emailEnabled: boolean;
  emailNewOrder: boolean;
  emailLowStock: boolean;
  emailStockOut: boolean;
  emailSyncError: boolean;
  emailWeeklyReport: boolean;
  emailTicketReply: boolean;
  emailPlanExpiry: boolean;
  pushEnabled: boolean;
  pushNewOrder: boolean;
  pushLowStock: boolean;
  pushSyncError: boolean;
  inAppEnabled: boolean;
  inAppSoundEnabled: boolean;
  digestFrequency: 'realtime' | 'daily' | 'weekly';
  digestHour: number;
}

type BooleanPrefKey = keyof Pick<
  NotificationPrefs,
  | 'emailEnabled'
  | 'emailNewOrder'
  | 'emailLowStock'
  | 'emailStockOut'
  | 'emailSyncError'
  | 'emailWeeklyReport'
  | 'emailTicketReply'
  | 'emailPlanExpiry'
  | 'pushEnabled'
  | 'pushNewOrder'
  | 'pushLowStock'
  | 'pushSyncError'
  | 'inAppEnabled'
  | 'inAppSoundEnabled'
>;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function PrefRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (value: boolean) => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex max-w-[min(100%,20rem)] flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function NotificationsTab(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, isSupported } = usePushNotifications();

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data } = await api.get<{ data: NotificationPrefs }>(
        '/notifications/preferences',
      );
      return data.data;
    },
  });

  const pushStatusQuery = useQuery({
    queryKey: ['push-subscription-status'],
    queryFn: async (): Promise<{ subscribed: boolean }> => {
      const { data } = await api.get<{ subscribed: boolean }>('/push/status');
      return data;
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (body: Partial<NotificationPrefs>) =>
      api
        .patch<{ data: NotificationPrefs }>('/notifications/preferences', body)
        .then((r) => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-preferences'],
      });
    },
    onError: () => {
      toast.error('Kaydedilemedi. Lütfen tekrar deneyin.');
    },
  });

  const browserPushMutation = useMutation({
    mutationFn: async (enable: boolean): Promise<void> => {
      if (enable) {
        const ok = await subscribe();
        if (!ok) {
          throw new Error('Tarayıcı bildirimleri etkinleştirilemedi.');
        }
        await api.patch('/notifications/preferences', { pushEnabled: true });
        return;
      }
      await unsubscribe();
      await api.patch('/notifications/preferences', { pushEnabled: false });
    },
    onSuccess: (_, enable) => {
      void queryClient.invalidateQueries({ queryKey: ['push-subscription-status'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success(
        enable ? 'Tarayıcı bildirimleri açıldı.' : 'Tarayıcı bildirimleri kapatıldı.',
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız.';
      toast.error(msg);
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: () => api.post('/notifications/test-email'),
    onSuccess: () => toast.success('Test e-postası gönderildi.'),
    onError: () => toast.error('Test e-postası gönderilemedi.'),
  });

  const testPushMutation = useMutation({
    mutationFn: () => api.post('/notifications/test-push'),
    onSuccess: () => toast.success('Test push bildirimi gönderildi.'),
    onError: () =>
      toast.error('Push gönderilemedi. Tarayıcı aboneliğini kontrol edin.'),
  });

  const prefs = prefsQuery.data;
  const pushSubscribed = pushStatusQuery.data?.subscribed ?? false;
  const busy =
    prefsQuery.isLoading ||
    updatePrefs.isPending ||
    pushStatusQuery.isLoading ||
    browserPushMutation.isPending;

  const setPref = (key: BooleanPrefKey, value: boolean): void => {
    updatePrefs.mutate({ [key]: value });
  };

  if (prefsQuery.isError) {
    return (
      <QueryErrorAlert
        error={prefsQuery.error}
        onRetry={() => {
          void prefsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Bildirim ayarları</h3>
        <p className="text-sm text-muted-foreground">
          E-posta, push ve uygulama içi bildirimlerinizi kanal ve olay bazında yönetin.
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
        <>
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="size-4 text-sky-500" />
                E-posta bildirimleri
              </CardTitle>
              <CardDescription className="text-xs">
                Sipariş, stok ve sistem olayları için e-posta alın.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4">
              <PrefRow
                id="email-master"
                label="E-posta bildirimleri"
                checked={prefs.emailEnabled}
                disabled={busy}
                onCheckedChange={(v) => setPref('emailEnabled', v)}
              />
              <div className="space-y-3 border-t pt-4">
                <PrefRow
                  id="email-new-order"
                  label="Yeni sipariş"
                  checked={prefs.emailNewOrder}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailNewOrder', v)}
                />
                <PrefRow
                  id="email-low-stock"
                  label="Düşük stok"
                  checked={prefs.emailLowStock}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailLowStock', v)}
                />
                <PrefRow
                  id="email-stock-out"
                  label="Stok tükenmesi"
                  checked={prefs.emailStockOut}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailStockOut', v)}
                />
                <PrefRow
                  id="email-sync"
                  label="Senkron hatası"
                  checked={prefs.emailSyncError}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailSyncError', v)}
                />
                <PrefRow
                  id="email-weekly"
                  label="Haftalık rapor"
                  checked={prefs.emailWeeklyReport}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailWeeklyReport', v)}
                />
                <PrefRow
                  id="email-ticket"
                  label="Destek talebi yanıtı"
                  checked={prefs.emailTicketReply}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailTicketReply', v)}
                />
                <PrefRow
                  id="email-plan"
                  label="Plan süresi uyarısı"
                  checked={prefs.emailPlanExpiry}
                  disabled={busy || !prefs.emailEnabled}
                  onCheckedChange={(v) => setPref('emailPlanExpiry', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-sky-500" />
                Özet e-posta
              </CardTitle>
              <CardDescription className="text-xs">
                Anlık dışındaki seçeneklerde bildirimler tek e-postada toplanır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="digest-frequency">Özet sıklığı</Label>
                <Select
                  value={prefs.digestFrequency}
                  disabled={busy || !prefs.emailEnabled}
                  onValueChange={(v) => {
                    updatePrefs.mutate({
                      digestFrequency: v as NotificationPrefs['digestFrequency'],
                    });
                  }}
                >
                  <SelectTrigger id="digest-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Anlık</SelectItem>
                    <SelectItem value="daily">Günlük özet</SelectItem>
                    <SelectItem value="weekly">Haftalık özet (Pazartesi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {prefs.digestFrequency !== 'realtime' ? (
                <div className="space-y-2">
                  <Label htmlFor="digest-hour">Gönderim saati</Label>
                  <Select
                    value={String(prefs.digestHour)}
                    disabled={busy || !prefs.emailEnabled}
                    onValueChange={(v) => {
                      updatePrefs.mutate({ digestHour: Number(v) });
                    }}
                  >
                    <SelectTrigger id="digest-hour" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {`${String(h).padStart(2, '0')}:00`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-sky-500" />
                Push bildirimleri
                <Badge variant="secondary" className="text-xs font-normal">
                  Beta
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Tarayıcı izni ile birlikte anlık push bildirimleri alın.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4">
              <PrefRow
                id="push-master"
                label="Push bildirimleri etkinleştir"
                description="Aşağıdaki tarayıcı izni ile birlikte kullanılır."
                checked={prefs.pushEnabled}
                disabled={busy}
                onCheckedChange={(v) => setPref('pushEnabled', v)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Tarayıcı izni</p>
                  <p className="text-xs text-muted-foreground">
                    HTTPS veya localhost gerekir.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || !isSupported || !prefs.pushEnabled}
                    onClick={() => browserPushMutation.mutate(true)}
                  >
                    İzin iste
                  </Button>
                  <Switch
                    id="n-browser-push"
                    checked={pushSubscribed}
                    disabled={busy || !isSupported || !prefs.pushEnabled}
                    onCheckedChange={(v) => {
                      browserPushMutation.mutate(v);
                    }}
                  />
                </div>
              </div>
              {!isSupported ? (
                <p className="text-xs text-muted-foreground">
                  Bu tarayıcı web push desteklemiyor.
                </p>
              ) : null}
              <div className="space-y-3 border-t pt-4">
                <PrefRow
                  id="push-new-order"
                  label="Yeni sipariş"
                  checked={prefs.pushNewOrder}
                  disabled={busy || !prefs.pushEnabled}
                  onCheckedChange={(v) => setPref('pushNewOrder', v)}
                />
                <PrefRow
                  id="push-sync"
                  label="Senkron hatası"
                  checked={prefs.pushSyncError}
                  disabled={busy || !prefs.pushEnabled}
                  onCheckedChange={(v) => setPref('pushSyncError', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BellRing className="size-4 text-sky-500" />
                Uygulama içi bildirimler
              </CardTitle>
              <CardDescription className="text-xs">
                Panelde zil simgesi ve bildirim listesi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4">
              <PrefRow
                id="in-app-enabled"
                label="Bildirim merkezi"
                checked={prefs.inAppEnabled}
                disabled={busy}
                onCheckedChange={(v) => setPref('inAppEnabled', v)}
              />
              <PrefRow
                id="in-app-sound"
                label="Bildirim sesi"
                checked={prefs.inAppSoundEnabled}
                disabled={busy || !prefs.inAppEnabled}
                onCheckedChange={(v) => setPref('inAppSoundEnabled', v)}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-dashed">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="text-sm font-semibold">Test bildirimi</CardTitle>
              <CardDescription className="text-xs">
                Ayarlarınızın çalıştığını doğrulamak için test mesajı gönderin.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={testEmailMutation.isPending || !prefs.emailEnabled}
                  onClick={() => testEmailMutation.mutate()}
                >
                  Test e-postası gönder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    testPushMutation.isPending ||
                    !prefs.pushEnabled ||
                    !pushSubscribed
                  }
                  onClick={() => testPushMutation.mutate()}
                >
                  Test push gönder
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t('settings.notificationsDedicatedHint')}{' '}
        <Link
          to="/settings/notifications"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('settings.notificationsDedicatedLink')}
        </Link>
      </p>
    </div>
  );
}
