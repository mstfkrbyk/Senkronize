import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/auth.store';
import { parseInAppNotification, useNotificationsStore } from '@/store/notifications.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;
let socketConnectionRefCount = 0;

function attachInAppNotificationListener(s: Socket): void {
  const handler = (payload: unknown): void => {
    const notif = parseInAppNotification(payload);
    if (!notif) {
      return;
    }
    useNotificationsStore.getState().addNotification(notif);
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
    toast(notif.title, { description: notif.message });
  };
  s.on('notification:new', handler);
}

/** Birden fazla bileşen aynı anda bağlantı tutabilir; son release'te socket kapanır. */
export function retainSocketConnection(): () => void {
  socketConnectionRefCount += 1;
  connectSocket();
  return (): void => {
    socketConnectionRefCount = Math.max(0, socketConnectionRefCount - 1);
    if (socketConnectionRefCount === 0) {
      disconnectSocket();
    }
  };
}

function attachSocketLifecycle(s: Socket): void {
  s.on('disconnect', (reason: string) => {
    if (reason === 'io client disconnect') {
      return;
    }
    toast.info('Sunucu bağlantısı kesildi, yeniden bağlanılıyor...');
  });
  s.on('reconnect', () => {
    toast.success('Bağlantı yenilendi');
    void queryClient.invalidateQueries();
  });
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      auth: { token: useAuthStore.getState().token },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    attachSocketLifecycle(socket);
    attachInAppNotificationListener(socket);
  }
  return socket;
}

export function connectSocket(): void {
  const token = useAuthStore.getState().token;
  if (!token) {
    return;
  }
  const s = getSocket();
  s.auth = { token };
  s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
