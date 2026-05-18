import { AxiosError } from 'axios';

import { SyncFailedError } from '../common/errors/sync-failed.error';

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function normalizeOrdersRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    if (isRecord(data.result)) {
      return normalizeOrdersRows(data.result);
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.orders)) {
      return data.orders;
    }
    if (Array.isArray(data.receipts)) {
      return data.receipts;
    }
    if (Array.isArray(data.orderList)) {
      return data.orderList;
    }
  }
  return [];
}

export function normalizeProductRows(
  data: unknown,
): { rows: unknown[]; total?: number } {
  if (Array.isArray(data)) {
    return { rows: data };
  }
  if (isRecord(data)) {
    if (isRecord(data.result)) {
      return normalizeProductRows(data.result);
    }
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.products)
          ? data.products
          : Array.isArray(data.listings)
            ? data.listings
            : [];
    const totalRaw = data.totalCount ?? data.total ?? data.count;
    const total =
      typeof totalRaw === 'number' && Number.isFinite(totalRaw)
        ? totalRaw
        : undefined;
    return { rows, total };
  }
  return { rows: [] };
}

export function axiosErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    return `HTTP ${String(status ?? '—')}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Bilinmeyen hata';
}

export function throwSyncFailed(
  platform: string,
  operation: string,
  error: unknown,
): never {
  throw new SyncFailedError(
    `${platform} ${operation} başarısız — ${axiosErrorMessage(error)}`,
    { cause: error instanceof Error ? error : undefined },
  );
}
