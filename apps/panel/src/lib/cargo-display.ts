import type { CargoProvider } from '@senkronize/shared';

import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';
import type { CargoTrackingStatus } from '@/types/shipping';

export interface CargoDisplayMeta {
  label: string;
  logo: string;
  color: string;
}

const CARGO_LOGOS: Partial<Record<string, string>> = {
  YURTICI: '🟡',
  ARAS: '🔴',
  MNG: '🟠',
  SURAT: '🔵',
  PTT: '📬',
  PTT_KARGO: '📬',
  UPS: '🟤',
  DHL: '🟡',
  DHL_PARCEL: '📦',
  FEDEX: '🟣',
  SENDEO: '🟢',
  HEPSIJET: '🟣',
  TRENDYOL_EXPRESS: '🧡',
  NETLOG: '📦',
  HOROZ: '🚚',
  TNT: '🟠',
  GLS: '🔵',
  DPD: '🔴',
  HERMES: '🟡',
  POSTNL: '🟠',
  BRINGO: '🟢',
  CEVA: '🔵',
  NART_KARGO: '📦',
  KOLAY_GELSIN: '⚡',
  PACKUPP: '📦',
  GELAL: '🟢',
  EKOL: '🔵',
  KOLLAY: '📦',
};

const CARGO_COLORS: Partial<Record<string, string>> = {
  YURTICI: 'yellow',
  ARAS: 'red',
  MNG: 'orange',
  SURAT: 'blue',
  PTT: 'blue',
  UPS: 'amber',
  DHL: 'yellow',
  FEDEX: 'purple',
  SENDEO: 'green',
  HEPSIJET: 'violet',
};

export function normalizeCargoPlatformKey(provider?: string | null): string {
  if (!provider?.trim()) {
    return '';
  }
  return provider.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function getCargoDisplay(provider?: string | null): CargoDisplayMeta {
  const key = normalizeCargoPlatformKey(provider);
  const fromOptions = CARGO_PROVIDER_OPTIONS.find((o) => o.value === key);
  const label = fromOptions?.label ?? (provider?.trim() || 'Kargo');
  return {
    label,
    logo: CARGO_LOGOS[key] ?? '🚚',
    color: CARGO_COLORS[key] ?? 'slate',
  };
}

export function cargoProviderLabel(provider: string): string {
  return getCargoDisplay(provider).label;
}

export function isKnownCargoProvider(provider: string): provider is CargoProvider {
  const key = normalizeCargoPlatformKey(provider);
  return CARGO_PROVIDER_OPTIONS.some((o) => o.value === key);
}

export const SHIPMENT_TIMELINE_STEPS = [
  { key: 'CREATED', label: 'Oluşturuldu' },
  { key: 'WAREHOUSE', label: 'Depoda' },
  { key: 'IN_TRANSIT', label: 'Yolda' },
  { key: 'DELIVERED', label: 'Teslim Edildi' },
] as const;

export function trackingStatusToTimelineIndex(status: CargoTrackingStatus): number {
  switch (status) {
    case 'DELIVERED':
      return 3;
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT':
      return 2;
    case 'CREATED':
      return 0;
    case 'FAILED':
    case 'RETURNED':
      return 1;
    default:
      return 0;
  }
}

export const CONNECTION_STATUS_LABELS: Record<string, string> = {
  healthy: 'Aktif',
  warning: 'Uyarı',
  error: 'Hata',
  unknown: 'Bilinmiyor',
  inactive: 'Pasif',
};

export const CONNECTION_STATUS_BADGE: Record<string, string> = {
  healthy: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  unknown: 'border-slate-200 bg-slate-100 text-slate-700',
  inactive: 'border-slate-200 bg-slate-100 text-slate-600',
};
