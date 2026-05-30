import type { TFunction } from 'i18next';

import type { PlanTier } from '@/types/subscription';
import type { PartnerStatus } from '@/types/partner';

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  PENDING: 'Trial',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Pasif',
  TERMINATED: 'Sonlandı',
};

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

export function formatTry(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return tryFormatter.format(value);
}

export function formatTryPlain(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function planLabel(plan: string): string {
  return PLAN_LABELS[plan as PlanTier] ?? plan;
}

/** Keşif kartları için istikrarlı görüntü puanı (1–5) */
export function partnerDisplayRating(partnerId: string, activeClientCount: number): number {
  let hash = 0;
  for (let i = 0; i < partnerId.length; i++) {
    hash = (hash + partnerId.charCodeAt(i) * (i + 1)) % 97;
  }
  const base = 3.6 + (hash % 10) / 20;
  const boost = Math.min(0.9, activeClientCount * 0.03);
  return Math.min(5, Math.round((base + boost) * 10) / 10);
}

export type ExpertiseFilterValue = 'all' | 'pazaryeri' | 'erp' | 'tam';

export function getExpertiseFilterOptions(
  t: TFunction,
): { value: ExpertiseFilterValue; label: string }[] {
  return [
    { value: 'all', label: t('partner.pages.discovery.expertise.all') },
    { value: 'pazaryeri', label: t('partner.pages.discovery.expertise.marketplace') },
    { value: 'erp', label: t('partner.pages.discovery.expertise.erp') },
    { value: 'tam', label: t('partner.pages.discovery.expertise.full') },
  ];
}

export function matchesExpertise(description: string, filter: string): boolean {
  if (filter === 'all') {
    return true;
  }
  const d = description.toLowerCase();
  if (filter === 'pazaryeri') {
    return d.includes('pazaryeri') || d.includes('marketplace') || d.includes('trendyol');
  }
  if (filter === 'erp') {
    return d.includes('erp') || d.includes('logo') || d.includes('mikro');
  }
  if (filter === 'tam') {
    return d.includes('tam') || d.includes('entegrasyon') || d.includes('partner');
  }
  return true;
}
