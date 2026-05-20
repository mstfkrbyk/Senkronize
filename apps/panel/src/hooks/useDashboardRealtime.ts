import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useSocket } from '@/hooks/useSocket';
import type {
  DashboardApiSummary,
  DashboardKpiUpdatePayload,
  DashboardKpisResponse,
  DashboardOrderNewPayload,
} from '@/types/dashboard-widgets';
import type { Order } from '@/types/order';

function bumpSummary(
  old: DashboardApiSummary | undefined,
  patch: Partial<DashboardApiSummary>,
): DashboardApiSummary | undefined {
  if (!old) {
    return old;
  }
  return { ...old, ...patch };
}

function formatTry(amount: string | number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(amount));
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
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sales-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'platform-breakdown'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'recent'] });
    };

    const invalidateLowStock = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['listings', 'low-stock'] });
    };

    const onDashboardOrderNew = (raw: unknown): void => {
      const payload = raw as DashboardOrderNewPayload;
      queryClient.setQueriesData<DashboardApiSummary>(
        { queryKey: ['dashboard', 'summary'] },
        (old) =>
          bumpSummary(old, {
            todayOrders: (old?.todayOrders ?? 0) + 1,
            pendingOrders: (old?.pendingOrders ?? 0) + 1,
            windowOrders: (old?.windowOrders ?? 0) + 1,
          }),
      );

      if (payload?.orderId) {
        const stub: Order = {
          id: payload.orderId,
          platform: payload.platform,
          platformOrderId: payload.orderId,
          customerName: payload.customer ?? 'Müşteri',
          totalAmount: String(payload.amount ?? '0'),
          currency: 'TRY',
          status: 'NEW',
          platformCreatedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          cargoTrackingNumber: null,
          cargoProvider: null,
          items: [],
        };
        queryClient.setQueriesData<Order[]>(
          { queryKey: ['dashboard', 'recent-orders'] },
          (old) => {
            const prev = old ?? [];
            if (prev.some((o) => o.id === stub.id)) {
              return prev;
            }
            return [stub, ...prev].slice(0, 10);
          },
        );
      }

      invalidateDashboard();
    };

    const onKpiUpdate = (raw: unknown): void => {
      const payload = raw as DashboardKpiUpdatePayload;
      if (payload?.kpis) {
        queryClient.setQueriesData<DashboardKpisResponse>(
          { queryKey: ['dashboard', 'kpis'] },
          payload.kpis,
        );
      }
      invalidateDashboard();
    };

    const onStockAlert = (_raw: unknown): void => {
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

    const onOrderNewToast = (raw: unknown): void => {
      let description = 'Yeni sipariş alındı.';
      if (typeof raw === 'object' && raw !== null) {
        const d = raw as Record<string, unknown>;
        const customer =
          typeof d.customer === 'string'
            ? d.customer
            : typeof d.buyerName === 'string'
              ? d.buyerName
              : 'Müşteri';
        const amt = d.amount ?? d.totalAmount;
        const amountStr =
          typeof amt === 'string' || typeof amt === 'number'
            ? formatTry(amt)
            : '—';
        description = `${customer} · ${amountStr}`;
      }
      toast.success('Yeni sipariş!', { description, duration: 5000 });
    };

    socket.on('dashboard.order_new', onDashboardOrderNew);
    socket.on('dashboard.kpi_update', onKpiUpdate);
    socket.on('dashboard.stock_alert', onStockAlert);
    socket.on('sync.completed', onSyncCompleted);
    socket.on('sync:completed', onSyncCompleted);
    socket.on('order.new', onOrderNewToast);
    socket.on('order:created', onOrderNewToast);

    socket.on('order:created', onDashboardOrderNew);
    socket.on('order:new', onDashboardOrderNew);
    socket.on('stock:low', onStockAlert);
    socket.on('stock:alert', onStockAlert);
    socket.on('dashboard:update', invalidateDashboard);
    socket.on('stock:updated', invalidateLowStock);

    return (): void => {
      socket.off('dashboard.order_new', onDashboardOrderNew);
      socket.off('dashboard.kpi_update', onKpiUpdate);
      socket.off('dashboard.stock_alert', onStockAlert);
      socket.off('sync.completed', onSyncCompleted);
      socket.off('sync:completed', onSyncCompleted);
      socket.off('order.new', onOrderNewToast);
      socket.off('order:created', onOrderNewToast);
      socket.off('order:created', onDashboardOrderNew);
      socket.off('order:new', onDashboardOrderNew);
      socket.off('stock:low', onStockAlert);
      socket.off('stock:alert', onStockAlert);
      socket.off('dashboard:update', invalidateDashboard);
      socket.off('stock:updated', invalidateLowStock);
    };
  }, [socket, queryClient]);
}
