import { useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';

import {
  disconnectSocket,
  getSocket,
  retainSocketConnection,
} from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

export interface UseSocketResult {
  socket: Socket | null;
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

export function useSocket(): UseSocketResult {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return undefined;
    }
    return retainSocketConnection();
  }, [token]);

  const on = useCallback(
    (event: string, handler: (data: unknown) => void): (() => void) => {
      const s = getSocket();
      const listener = (payload: unknown): void => {
        handler(payload);
      };
      s.on(event, listener);
      return (): void => {
        s.off(event, listener);
      };
    },
    [],
  );

  const socket = token ? getSocket() : null;

  return { socket, on };
}
