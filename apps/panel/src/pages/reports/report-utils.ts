import { format, startOfYear, subDays } from 'date-fns';

import { getMarketplaceDisplay } from '@/lib/platform-display';

export type PeriodPreset = '7' | '30' | '90' | 'ytd' | 'custom';

export const SALES_PLATFORM_OPTIONS = [
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'AMAZON_TR',
] as const;

export const CHART_PLATFORM_COLORS: Record<string, string> = {
  TRENDYOL: '#f97316',
  HEPSIBURADA: '#f59e0b',
  N11: '#8b5cf6',
  AMAZON_TR: '#0ea5e9',
};

export function formatTry(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function periodRangeFromPreset(preset: PeriodPreset): { start: string; end: string } {
  const end = new Date();
  if (preset === 'ytd') {
    return {
      start: format(startOfYear(end), 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }
  if (preset === 'custom') {
    return { start: format(subDays(end, 29), 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
  }
  const days = preset === '7' ? 6 : preset === '90' ? 89 : 29;
  return {
    start: format(subDays(end, days), 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function platformDisplayName(code: string): string {
  return getMarketplaceDisplay(code).label;
}

export function pdfPeriodFromDates(start: string, end: string): '7d' | '30d' | '90d' {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const diff = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 7) return '7d';
  if (diff >= 80) return '90d';
  return '30d';
}
