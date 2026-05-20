const SNAPSHOT_KEY = 'senkronize-offline-snapshot';
const QUEUE_KEY = 'senkronize-offline-queue';

export interface OfflineDashboardSnapshot {
  savedAt: string;
  ordersToday?: number;
  revenueToday?: number;
  pendingOrders?: number;
  lowStockCount?: number;
}

export interface OfflineQueuedMutation {
  id: string;
  method: string;
  url: string;
  body?: string;
  createdAt: string;
}

export function saveOfflineSnapshot(
  snapshot: Omit<OfflineDashboardSnapshot, 'savedAt'>,
): void {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* storage full or private mode */
  }
}

export function loadOfflineSnapshot(): OfflineDashboardSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as OfflineDashboardSnapshot;
  } catch {
    return null;
  }
}

export function enqueueOfflineMutation(
  mutation: Omit<OfflineQueuedMutation, 'id' | 'createdAt'>,
): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: OfflineQueuedMutation[] = raw ? (JSON.parse(raw) as OfflineQueuedMutation[]) : [];
    queue.push({
      ...mutation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'QUEUE_OFFLINE_MUTATION' });
      });
    }
  } catch {
    /* ignore */
  }
}

export function loadOfflineQueue(): OfflineQueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueuedMutation[]) : [];
  } catch {
    return [];
  }
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
