import type {
  CampaignStatus,
  CampaignType,
  CampaignDiscountType,
} from '@/types/campaign';

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  FLASH_SALE: 'Flaş indirim',
  SEASONAL: 'Sezonsal',
  CLEARANCE: 'Stok eritme',
  BUNDLE: 'Paket indirim',
  LOYALTY: 'Sadakat',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  ENDED: 'Bitti',
};

export const DISCOUNT_TYPE_LABELS: Record<CampaignDiscountType, string> = {
  PERCENTAGE: 'Yüzde (%)',
  FIXED: 'Sabit (₺)',
  PRICE_SET: 'Fiyat belirle',
};

export const PLATFORM_OPTIONS = [
  { value: 'TRENDYOL', label: 'Trendyol' },
  { value: 'HEPSIBURADA', label: 'Hepsiburada' },
  { value: 'N11', label: 'n11' },
  { value: 'AMAZON_TR', label: 'Amazon TR' },
  { value: 'CICEKSEPETI', label: 'Çiçeksepeti' },
  { value: 'PAZARAMA', label: 'Pazarama' },
] as const;

export function platformLabel(code: string): string {
  return PLATFORM_OPTIONS.find((p) => p.value === code)?.label ?? code;
}

export function formatCampaignDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}
