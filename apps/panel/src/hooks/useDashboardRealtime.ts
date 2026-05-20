import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSocket } from '@/hooks/useSocket';

export function useDashboardRealtime(): void {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const invalidateDashboard = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'recent'] });
    };

    const invalidateLowStock = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['listings', 'low-stock'] });
    };

    socket.on('order:new', invalidateDashboard);
    socket.on('dashboard:update', invalidateDashboard);
    socket.on('stock:updated', invalidateLowStock);
    const onSyncCompleted = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    };

    socket.on('sync:completed', onSyncCompleted);

    return (): void => {
      socket.off('order:new', invalidateDashboard);
      socket.off('dashboard:update', invalidateDashboard);
      socket.off('stock:updated', invalidateLowStock);
      socket.off('sync:completed', onSyncCompleted);
    };
  }, [socket, queryClient]);
}
