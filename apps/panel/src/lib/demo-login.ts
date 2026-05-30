import {
  DEMO_ORG_SLUGS,
  type DemoOrgSlug,
} from '@/lib/demo-banner-messages';

/** Seed ile aynı demo şifresi (`prisma/seed.ts` → `DEMO_PASSWORD`). */
export const DEMO_LOGIN_PASSWORD = 'demo123456';

/** `prisma/seed.ts` → `PARTNER_DEMO_PASSWORD` */
export const PARTNER_DEMO_LOGIN_PASSWORD = 'Partner2026!';

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

export type DemoLoginAccount = {
  slug: DemoOrgSlug;
  email: string;
  label: string;
  /** Kısa senaryo (.env.example / seed açıklaması). */
  description: string;
  /** `.env.example` productLines + accountingMode özeti. */
  productLineHint: string;
};

/** `DEMO_ORG_SLUGS` ile birebir; eksik slug derleme hatası verir. */
const DEMO_LOGIN_BY_SLUG: Record<
  DemoOrgSlug,
  Omit<DemoLoginAccount, 'slug'>
> = {
  'demo-muhasebe': {
    email: 'demo-muhasebe@senkronize.com',
    label: 'Ön Muhasebe',
    description: 'Fatura, müşteri ve KDV örnekleri',
    productLineHint: 'Ön Muhasebe · yerel muhasebe',
  },
  'demo-entegrasyon': {
    email: 'demo-entegrasyon@senkronize.com',
    label: 'Entegrasyon',
    description: 'Pazaryeri siparişleri ve katalog',
    productLineHint: 'Entegrasyon',
  },
  'demo-paket': {
    email: 'demo-paket@senkronize.com',
    label: 'Tam paket',
    description: 'Entegrasyon ve muhasebe birlikte',
    productLineHint: 'Tam paket · yerel muhasebe',
  },
  'demo-external-erp': {
    email: 'demo-external-erp@senkronize.com',
    label: 'Harici ERP',
    description: 'Tam paket, muhasebe harici ERP (Paraşüt stub)',
    productLineHint: 'Tam paket · harici ERP',
  },
  'demo-partner': {
    email: 'partner@partner.com',
    label: 'Partner bayi',
    description: 'Senkronize Demo Partner — müşteri org yönetimi',
    productLineHint: 'Tam paket',
  },
  'demo-partner-musteri': {
    email: 'demo-partner-musteri@senkronize.com',
    label: 'Partner müşterisi (A)',
    description: 'Demo Partner A.Ş. — tam paket, bağlı müşteri org',
    productLineHint: 'Tam paket · yerel muhasebe',
  },
  'demo-partner-musteri-2': {
    email: 'demo-magaza2@senkronize.com',
    label: 'Partner müşterisi (B)',
    description: 'Demo Mağaza İkinci — yalnızca entegrasyon hattı',
    productLineHint: 'Entegrasyon',
  },
};

export const DEMO_LOGIN_ACCOUNTS: readonly DemoLoginAccount[] =
  DEMO_ORG_SLUGS.map((slug) => ({
    slug,
    ...DEMO_LOGIN_BY_SLUG[slug],
  }));

export function getDemoLoginPassword(email: string): string {
  if (email === 'partner@partner.com') {
    return PARTNER_DEMO_LOGIN_PASSWORD;
  }
  return DEMO_LOGIN_PASSWORD;
}
