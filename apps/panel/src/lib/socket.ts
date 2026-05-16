import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/store/auth.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      auth: { token: useAuthStore.getState().token },
      transports: ['websocket'],
      autoConnect: false,
    });
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
