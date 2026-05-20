import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSocket } from '@/hooks/useSocket';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';

function bumpSummary(
  old: DashboardApiSummary | undefined,
  patch: Partial<DashboardApiSummary>,
): DashboardApiSummary | undefined {
  if (!old) {
    return old;
  }
  return { ...old, ...patch };
}

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

    const onOrderCreated = (): void => {
      queryClient.setQueriesData<DashboardApiSummary>(
        { queryKey: ['dashboard', 'summary'] },
        (old) =>
          bumpSummary(old, {
            todayOrders: (old?.todayOrders ?? 0) + 1,
            pendingOrders: (old?.pendingOrders ?? 0) + 1,
          }),
      );
      invalidateDashboard();
    };

    const onStockLow = (): void => {
      queryClient.setQueriesData<DashboardApiSummary>(
        { queryKey: ['dashboard', 'summary'] },
        (old) =>
          bumpSummary(old, {
            lowStockCount: (old?.lowStockCount ?? 0) + 1,
          }),
      );
      invalidateLowStock();
    };

    const onSyncCompleted = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    };

    socket.on('order:created', onOrderCreated);
    socket.on('order:new', onOrderCreated);
    socket.on('stock:low', onStockLow);
    socket.on('stock:alert', onStockLow);
    socket.on('dashboard:update', invalidateDashboard);
    socket.on('stock:updated', invalidateLowStock);
    socket.on('sync:completed', onSyncCompleted);

    return (): void => {
      socket.off('order:created', onOrderCreated);
      socket.off('order:new', onOrderCreated);
      socket.off('stock:low', onStockLow);
      socket.off('stock:alert', onStockLow);
      socket.off('dashboard:update', invalidateDashboard);
      socket.off('stock:updated', invalidateLowStock);
      socket.off('sync:completed', onSyncCompleted);
    };
  }, [socket, queryClient]);
}
