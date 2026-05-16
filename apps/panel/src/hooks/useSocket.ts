import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';

import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

export function useSocket(): Socket | null {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, [token]);

  return token ? getSocket() : null;
}
