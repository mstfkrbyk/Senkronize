export const tryFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

export function formatTry(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || Number.isNaN(n)) {
    return '—';
  }
  return tryFmt.format(n);
}

export function pctChange(oldPrice: string | number, newPrice: string | number): number {
  const o = typeof oldPrice === 'string' ? Number(oldPrice) : oldPrice;
  const n = typeof newPrice === 'string' ? Number(newPrice) : newPrice;
  if (Number.isNaN(o) || o === 0 || Number.isNaN(n)) {
    return 0;
  }
  return ((n - o) / o) * 100;
}

export const REASON_LABELS: Record<string, string> = {
  manual: 'Manuel',
  rule: 'Kural',
  buybox: 'BuyBox',
  campaign: 'Kampanya',
  sync: 'Senkronizasyon',
  MATCH_BUYBOX: 'BuyBox',
  BEAT_BUYBOX: 'BuyBox',
};

export const PLATFORM_OPTIONS = [
  { value: 'TRENDYOL', label: 'Trendyol' },
  { value: 'HEPSIBURADA', label: 'Hepsiburada' },
  { value: 'N11', label: 'n11' },
  { value: 'AMAZON_TR', label: 'Amazon TR' },
] as const;
