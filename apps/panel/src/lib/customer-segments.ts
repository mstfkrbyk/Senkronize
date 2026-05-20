import type { CustomerSegmentKey } from '@/types/customer';

export const SEGMENT_LABELS: Record<CustomerSegmentKey, string> = {
  VIP: 'VIP',
  sadik: 'Sadık',
  yeni: 'Yeni',
  risk: 'Risk',
  kayip: 'Kayıp',
};

export const SEGMENT_BADGE_CLASS: Record<CustomerSegmentKey, string> = {
  VIP: 'bg-amber-100 text-amber-900 border-amber-200',
  sadik: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  yeni: 'bg-sky-100 text-sky-900 border-sky-200',
  risk: 'bg-orange-100 text-orange-900 border-orange-200',
  kayip: 'bg-red-100 text-red-900 border-red-200',
};

export const SEGMENT_CHART_COLORS: Record<CustomerSegmentKey, string> = {
  VIP: '#f59e0b',
  sadik: '#22c55e',
  yeni: '#0ea5e9',
  risk: '#f97316',
  kayip: '#ef4444',
};

export const SEGMENT_CRITERIA: Record<CustomerSegmentKey, string> = {
  VIP: 'Son 90 günde 5.000 ₺ üzeri harcama',
  sadik: '10+ sipariş, son 30 günde aktif',
  yeni: 'Son 30 günde kayıtlı',
  risk: '60–90 gündür sipariş yok',
  kayip: '90+ gündür sipariş yok',
};

export const SEGMENT_OPTIONS: Array<{ value: CustomerSegmentKey; label: string }> =
  (Object.keys(SEGMENT_LABELS) as CustomerSegmentKey[]).map((value) => ({
    value,
    label: SEGMENT_LABELS[value],
  }));

const SEGMENT_PRIORITY: CustomerSegmentKey[] = [
  'VIP',
  'sadik',
  'yeni',
  'risk',
  'kayip',
];

export function primarySegment(
  segments: CustomerSegmentKey[],
): CustomerSegmentKey | null {
  for (const key of SEGMENT_PRIORITY) {
    if (segments.includes(key)) {
      return key;
    }
  }
  return null;
}

export function formatTryAmount(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) {
    return '—';
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatCustomerDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
