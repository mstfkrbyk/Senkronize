import type { PlanTier } from '@/types/subscription';

export type BusinessSector =
  | 'moda'
  | 'elektronik'
  | 'gida'
  | 'ev_yasam'
  | 'diger';

export const SECTOR_OPTIONS: readonly {
  id: BusinessSector;
  label: string;
}[] = [
  { id: 'moda', label: 'Moda & Giyim' },
  { id: 'elektronik', label: 'Elektronik' },
  { id: 'gida', label: 'Gıda & Market' },
  { id: 'ev_yasam', label: 'Ev & Yaşam' },
  { id: 'diger', label: 'Diğer' },
] as const;

export const ONBOARDING_MARKETPLACE_IDS = [
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'AMAZON_TR',
  'EBAY',
  'GITTIGIDIYOR',
  'ETSY',
  'CICEKSEPETI',
] as const;

export type StockManagementMethod = 'excel' | 'accounting' | 'other';

export const STOCK_MGMT_OPTIONS: readonly {
  id: StockManagementMethod;
  label: string;
}[] = [
  { id: 'excel', label: 'Excel / tablo' },
  { id: 'accounting', label: 'Muhasebe programı' },
  { id: 'other', label: 'Diğer' },
] as const;

export const PLAN_ANNUAL_PRICES: Record<
  PlanTier,
  { yearly: number; monthlyHint: number }
> = {
  BASLANGIC: { yearly: 2900, monthlyHint: 242 },
  GELISIM: { yearly: 5900, monthlyHint: 492 },
  PRO: { yearly: 9900, monthlyHint: 825 },
  KURUMSAL: { yearly: 19_900, monthlyHint: 1658 },
};

export const PLAN_TIERS: PlanTier[] = [
  'BASLANGIC',
  'GELISIM',
  'PRO',
  'KURUMSAL',
];

export const ONBOARDING_ERP_IDS = [
  'BIZIMHESAP',
  'PARASUT',
  'LOGO',
  'MIKRO',
  'NETSIS',
  'ETA',
] as const;

export interface OnboardingWizardDraft {
  companyName: string;
  sector: BusinessSector | null;
  hasErp: boolean | null;
  erpType: string | null;
  marketplaces: string[];
  recommendedPlan: PlanTier;
}

export function recommendPlan(input: {
  marketplaceCount: number;
  hasErp: boolean;
}): PlanTier {
  const { marketplaceCount, hasErp } = input;
  if (marketplaceCount >= 4 || (hasErp && marketplaceCount >= 2)) {
    return 'KURUMSAL';
  }
  if (marketplaceCount >= 3 || hasErp) {
    return 'PRO';
  }
  if (marketplaceCount >= 2 || hasErp) {
    return 'GELISIM';
  }
  if (marketplaceCount >= 1) {
    return 'GELISIM';
  }
  return 'BASLANGIC';
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

export const PLAN_DESCRIPTIONS: Record<PlanTier, string> = {
  BASLANGIC:
    'Tek kanal veya yeni başlayanlar için temel sipariş ve stok yönetimi.',
  GELISIM:
    'Birkaç pazaryerinde büyüyen işletmeler için gelişmiş senkronizasyon.',
  PRO: 'Çoklu kanal, ERP entegrasyonu ve BuyBox optimizasyonu.',
  KURUMSAL:
    'Yüksek hacim, çoklu pazaryeri ve kurumsal ERP ihtiyaçları için.',
};
