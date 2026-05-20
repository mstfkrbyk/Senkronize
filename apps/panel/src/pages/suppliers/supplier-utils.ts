import type {
  PurchaseOrderDetailDto,
  SupplierDto,
  SupplierPerformanceDto,
} from '@/types/supply';

export function formatTryAmount(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatSupplierDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function parseSupplierRating(rating: string | number | null | undefined): number | null {
  if (rating === null || rating === undefined || rating === '') {
    return null;
  }
  const n = typeof rating === 'string' ? Number.parseFloat(rating) : rating;
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : null;
}

export function supplierContactLine(s: SupplierDto): string {
  const parts = [s.email, s.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function currentMonthSpend(
  monthlySpend: Array<{ month: string; amount: number }> | undefined,
): number {
  if (!monthlySpend?.length) {
    return 0;
  }
  const key = new Date().toISOString().slice(0, 7);
  const hit = monthlySpend.find((m) => m.month === key);
  return hit?.amount ?? 0;
}

export function buildSpendTrendFromOrders(
  orders: PurchaseOrderDetailDto[] | SupplierPerformanceDto['orderHistory'],
): Array<{ month: string; label: string; amount: number }> {
  const map = new Map<string, number>();
  for (const po of orders) {
    if ('status' in po && po.status === 'CANCELLED') {
      continue;
    }
    const key = po.createdAt.slice(0, 7);
    const amt = Number.parseFloat(
      'totalAmount' in po && typeof po.totalAmount === 'string'
        ? po.totalAmount
        : String(po.totalAmount),
    );
    map.set(key, (map.get(key) ?? 0) + (Number.isFinite(amt) ? amt : 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({
      month,
      label: new Date(`${month}-01`).toLocaleDateString('tr-TR', {
        month: 'short',
        year: '2-digit',
      }),
      amount: Math.round(amount * 100) / 100,
    }));
}

export const COUNTRY_FILTER_OPTIONS = [
  { value: '', label: 'Tüm ülkeler' },
  { value: 'Türkiye', label: 'Türkiye' },
  { value: 'Çin', label: 'Çin' },
  { value: 'Almanya', label: 'Almanya' },
  { value: 'ABD', label: 'ABD' },
] as const;

export const CURRENCY_OPTIONS = ['TRY', 'USD', 'EUR', 'GBP'] as const;
