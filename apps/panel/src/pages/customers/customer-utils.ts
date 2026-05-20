import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

import type { CustomerOrderHistoryItem } from '@/types/customer';

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export interface NoteTimelineEntry {
  at: string;
  text: string;
}

export function parseNotesTimeline(notes: string | null): NoteTimelineEntry[] {
  if (!notes?.trim()) {
    return [];
  }
  const lines = notes.split('\n').filter((l) => l.trim().length > 0);
  return lines
    .map((line) => {
      const match = /^\[([^\]]+)\]\s*(.+)$/.exec(line.trim());
      if (match) {
        return { at: match[1]!, text: match[2]!.trim() };
      }
      return { at: '', text: line.trim() };
    })
    .reverse();
}

export interface SpendingTrendPoint {
  label: string;
  amount: number;
}

export function buildSpendingTrend(
  orders: CustomerOrderHistoryItem[],
): SpendingTrendPoint[] {
  const byMonth = new Map<string, number>();
  for (const order of orders) {
    const d = parseISO(order.platformCreatedAt);
    if (Number.isNaN(d.getTime())) {
      continue;
    }
    const key = format(d, 'yyyy-MM');
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(order.totalAmount));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, amount]) => ({
      label: format(parseISO(`${key}-01`), 'MMM yy', { locale: tr }),
      amount,
    }));
}

export function orderFrequencyLabel(
  totalOrders: number,
  firstOrderAt: string | null,
): string {
  if (totalOrders <= 0 || !firstOrderAt) {
    return '—';
  }
  const first = parseISO(firstOrderAt);
  const months = Math.max(
    1,
    (Date.now() - first.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );
  const perMonth = totalOrders / months;
  if (perMonth >= 1) {
    return `Ayda ~${perMonth.toFixed(1)} sipariş`;
  }
  const days = Math.round(30 / perMonth);
  return `~${days} günde bir sipariş`;
}

export function favoritePlatform(
  orders: CustomerOrderHistoryItem[],
): string | null {
  const counts = new Map<string, number>();
  for (const o of orders) {
    counts.set(o.platform, (counts.get(o.platform) ?? 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  for (const [platform, count] of counts) {
    if (count > max) {
      max = count;
      best = platform;
    }
  }
  return best;
}

export interface TopProductRow {
  name: string;
  quantity: number;
}

export function topPurchasedProducts(
  orders: CustomerOrderHistoryItem[],
): TopProductRow[] {
  void orders;
  return [];
}
