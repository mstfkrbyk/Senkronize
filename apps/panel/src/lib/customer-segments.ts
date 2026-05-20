import type { CustomerSegmentKey } from '@/types/customer';

export const SEGMENT_LABELS: Record<CustomerSegmentKey, string> = {
  VIP: 'VIP',
  sadik: 'Sadık',
  yeni: 'Yeni',
  riskAlti: 'Risk Altında',
};

export const SEGMENT_BADGE_CLASS: Record<CustomerSegmentKey, string> = {
  VIP: 'bg-amber-100 text-amber-900 border-amber-200',
  sadik: 'bg-sky-100 text-sky-900 border-sky-200',
  yeni: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  riskAlti: 'bg-red-100 text-red-900 border-red-200',
};

export const SEGMENT_CHART_COLORS: Record<CustomerSegmentKey, string> = {
  VIP: '#f59e0b',
  sadik: '#0ea5e9',
  yeni: '#22c55e',
  riskAlti: '#ef4444',
};

export const SEGMENT_OPTIONS: Array<{ value: CustomerSegmentKey; label: string }> = [
  { value: 'VIP', label: SEGMENT_LABELS.VIP },
  { value: 'sadik', label: SEGMENT_LABELS.sadik },
  { value: 'yeni', label: SEGMENT_LABELS.yeni },
  { value: 'riskAlti', label: SEGMENT_LABELS.riskAlti },
];

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
