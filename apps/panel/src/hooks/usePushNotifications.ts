import { api } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  isSupported: boolean;
} {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const { data: vapid } = await api.get<{ publicKey: string | null }>(
      '/push/vapid-public-key',
    );
    if (!vapid.publicKey) {
      return false;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await reg.update();
    const ready = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(vapid.publicKey);

    let subscription = await ready.pushManager.getSubscription();
    if (!subscription) {
      subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return false;
    }

    await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return true;
  };

  const unsubscribe = async (): Promise<void> => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const endpoint = sub?.endpoint;
    if (sub) {
      await sub.unsubscribe();
    }
    if (endpoint) {
      await api.delete('/push/unsubscribe', { data: { endpoint } });
    } else {
      await api.delete('/push/unsubscribe', { data: {} });
    }
  };

  return { subscribe, unsubscribe, isSupported };
}
