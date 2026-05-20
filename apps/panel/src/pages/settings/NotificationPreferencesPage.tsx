import type { ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { preferenceCategoryIcon } from '@/components/notifications/notification-utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { api } from '@/lib/api';
import {
  CHANNEL_ORDER,
  channelLabel,
  isChannelEnabled,
  masterChannelKey,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  type NotificationChannel,
} from '@/lib/notification-preferences-config';
import {
  fetchNotificationPreferences,
  patchNotificationPreferences,
  type NotificationPrefKey,
  type NotificationPrefPatch,
  type NotificationPrefs,
} from '@/lib/notification-preferences';
import { useAuthStore } from '@/store/auth.store';
import type { OrgPlanTier } from '@/types/auth';

const SMS_PREMIUM_PLANS: OrgPlanTier[] = ['PRO', 'KURUMSAL'];

function hasSmsPremium(plan: OrgPlanTier | undefined): boolean {
  return plan !== undefined && SMS_PREMIUM_PLANS.includes(plan);
}

function buildPatchForToggle(
  prefs: NotificationPrefs,
  key: NotificationPrefKey,
  value: boolean,
  eventId: string,
): NotificationPrefPatch {
  const patch: NotificationPrefPatch = { [key]: value };

  if (eventId === 'daily_digest' && key === 'emailEnabled') {
    patch.digestFrequency = value ? 'daily' : 'realtime';
  }

  if (key === 'emailEnabled' && !value) {
    return { emailEnabled: false };
  }
  if (key === 'pushEnabled' && !value) {
    return { pushEnabled: false };
  }
  if (key === 'inAppEnabled' && !value) {
    return { inAppEnabled: false };
  }

  if (
    value &&
    key.startsWith('email') &&
    key !== 'emailEnabled' &&
    !prefs.emailEnabled
  ) {
    patch.emailEnabled = true;
  }
  if (value && key.startsWith('push') && key !== 'pushEnabled' && !prefs.pushEnabled) {
    patch.pushEnabled = true;
  }

  return patch;
}

function readToggleValue(
  prefs: NotificationPrefs,
  channel: NotificationChannel,
  key: NotificationPrefKey,
  eventId: string,
): boolean {
  if (eventId === 'daily_digest' && key === 'emailEnabled') {
    return prefs.digestFrequency === 'daily' || prefs.digestFrequency === 'weekly';
  }
  return isChannelEnabled(prefs, channel, key);
}

export function NotificationPreferencesPage(): ReactElement {
  usePageTitle('Bildirim tercihleri');
  const queryClient = useQueryClient();
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const smsPremium = hasSmsPremium(plan);
  const { subscribe, unsubscribe, isSupported } = usePushNotifications();

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  const pushStatusQuery = useQuery({
    queryKey: ['push-subscription-status'],
    queryFn: async (): Promise<{ subscribed: boolean }> => {
      const { data } = await api.get<{ subscribed: boolean }>('/push/status');
      return data;
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (body: NotificationPrefPatch) => patchNotificationPreferences(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
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
        await patchNotificationPreferences({ pushEnabled: true });
        return;
      }
      await unsubscribe();
      await patchNotificationPreferences({ pushEnabled: false });
    },
    onSuccess: (_, enable) => {
      void queryClient.invalidateQueries({ queryKey: ['push-subscription-status'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success(
        enable ? 'Tarayıcı push bildirimleri açıldı.' : 'Push tercihi güncellendi.',
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız.';
      toast.error(msg);
    },
  });

  const prefs = prefsQuery.data;
  const busy =
    prefsQuery.isLoading ||
    updatePrefs.isPending ||
    browserPushMutation.isPending;

  const setPref = (
    key: NotificationPrefKey,
    value: boolean,
    eventId: string,
  ): void => {
    if (!prefs) {
      return;
    }
    updatePrefs.mutate(buildPatchForToggle(prefs, key, value, eventId));
  };

  if (prefsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Bildirim tercihleri yüklenemedi. Sayfayı yenileyin.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bildirim tercihleri
        </h1>
        <p className="text-sm text-muted-foreground">
          Olay ve kanal bazında bildirim alımını yapılandırın. Değişiklikler anında kaydedilir.
        </p>
      </div>

      {prefsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {prefs ? (
        <>
          <section className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Tarayıcı push bildirimleri</p>
                <p className="text-xs text-muted-foreground">
                  HTTPS veya localhost üzerinde tarayıcı izni gerekir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={pushStatusQuery.data?.subscribed ? 'default' : 'secondary'}>
                  {pushStatusQuery.data?.subscribed ? 'Aktif' : 'Kapalı'}
                </Badge>
                <Switch
                  checked={pushStatusQuery.data?.subscribed ?? false}
                  disabled={busy || !isSupported || !prefs.pushEnabled}
                  onCheckedChange={(v) => browserPushMutation.mutate(v)}
                />
              </div>
            </div>
            {!isSupported ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Bu tarayıcı web push desteklemiyor.
              </p>
            ) : null}
          </section>

          {NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => (
            <section key={category.id} className="rounded-lg border">
              <div className="flex items-start gap-3 border-b px-4 py-3">
                {preferenceCategoryIcon(category.id)}
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{category.title}</h2>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
              </div>

              <div className="hidden grid-cols-[1fr_repeat(4,minmax(4.5rem,1fr))] gap-2 border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Olay</span>
                {CHANNEL_ORDER.map((ch) => (
                  <span key={ch} className="text-center">
                    {channelLabel(ch)}
                  </span>
                ))}
              </div>

              <ul className="divide-y">
                {category.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[1fr_repeat(4,minmax(4.5rem,1fr))] sm:items-center sm:gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      {event.description ? (
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      ) : null}
                    </div>
                    {CHANNEL_ORDER.map((channel) => {
                      const key = event.channels[channel];

                      if (!key) {
                        return (
                          <span
                            key={channel}
                            className="hidden text-center text-xs text-muted-foreground sm:block"
                          >
                            —
                          </span>
                        );
                      }

                      const channelDisabled =
                        busy ||
                        (channel === 'email' &&
                          !prefs.emailEnabled &&
                          key !== 'emailEnabled' &&
                          event.id !== 'daily_digest') ||
                        (channel === 'push' &&
                          !prefs.pushEnabled &&
                          key !== 'pushEnabled') ||
                        (channel === 'sms' && !smsPremium);

                      const checked = readToggleValue(prefs, channel, key, event.id);

                      return (
                        <div
                          key={channel}
                          className="flex items-center justify-between gap-2 sm:flex-col sm:justify-center"
                        >
                          <Label
                            htmlFor={`${event.id}-${channel}`}
                            className="text-xs text-muted-foreground sm:sr-only"
                          >
                            {event.label} — {channelLabel(channel)}
                          </Label>
                          <div className="flex items-center gap-1.5">
                            {channel === 'sms' && !smsPremium ? (
                              <Badge variant="outline" className="text-[10px]">
                                Premium
                              </Badge>
                            ) : null}
                            <Switch
                              id={`${event.id}-${channel}`}
                              checked={checked}
                              disabled={channelDisabled}
                              onCheckedChange={(v) => setPref(key, v, event.id)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-4 border-t bg-muted/20 px-4 py-2">
                {CHANNEL_ORDER.map((channel) => {
                  const master = masterChannelKey(channel);
                  if (!master) {
                    return null;
                  }
                  const disabled =
                    busy || (channel === 'sms' && !smsPremium);
                  return (
                    <div key={channel} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{channelLabel(channel)} ana</span>
                      <Switch
                        checked={prefs[master] as boolean}
                        disabled={disabled}
                        onCheckedChange={(v) => setPref(master, v, `${category.id}-master`)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <Separator />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              to="/settings?tab=notifications"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Genel ayarlardaki bildirim sekmesi
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Bildirim sesi ve test mesajları için ayarlar sekmesini kullanın.
            </span>
          </div>

          {!smsPremium ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
              SMS bildirimleri Pro ve Kurumsal paketlerde kullanılabilir.{' '}
              <Link
                to="/settings/subscription"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Paketi yükselt
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
