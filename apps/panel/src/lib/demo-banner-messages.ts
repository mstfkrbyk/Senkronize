export const DEMO_ORG_SLUGS = [
  'demo-muhasebe',
  'demo-entegrasyon',
  'demo-hepsiburada',
  'demo-paket',
  'demo-external-erp',
  'demo-partner',
  'demo-partner-musteri',
  'demo-partner-musteri-2',
] as const;

export type DemoOrgSlug = (typeof DEMO_ORG_SLUGS)[number];

const DEMO_BANNER_MESSAGES: Record<DemoOrgSlug, string> = {
  'demo-muhasebe':
    'Ön Muhasebe demo hesabındasınız. Müşteri, fatura ve KDV verileri örnektir.',
  'demo-entegrasyon':
    'Entegrasyon demo hesabındasınız. Pazaryeri siparişleri ve katalog verileri örnektir.',
  'demo-hepsiburada':
    'Hepsiburada demo hesabındasınız. Sipariş ve katalog verileri yalnızca Hepsiburada kanalı içindir.',
  'demo-paket':
    'Tam paket demo hesabındasınız. Entegrasyon ve muhasebe verileri birlikte örnektir.',
  'demo-external-erp':
    'Harici ERP demo hesabındasınız. Muhasebe Paraşüt üzerinden; yerel fatura verisi yoktur.',
  'demo-partner':
    'Partner bayi demo hesabındasınız. Müşteri yönetimi ve komisyon verileri örnektir.',
  'demo-partner-musteri':
    'Demo Partner A.Ş. müşteri hesabındasınız. Bu org bir partner bayisine bağlıdır; veriler örnektir.',
  'demo-partner-musteri-2':
    'Demo Mağaza İkinci müşteri hesabındasınız. Yalnızca entegrasyon hattı; veriler örnektir.',
};

const DEFAULT_DEMO_BANNER_MESSAGE =
  'Bu bir demo ortamıdır. Veriler gerçek değildir.';

function isDemoOrgSlug(slug: string): slug is DemoOrgSlug {
  return (DEMO_ORG_SLUGS as readonly string[]).includes(slug);
}

export function getDemoBannerMessage(orgSlug: string | undefined): string {
  if (orgSlug && isDemoOrgSlug(orgSlug)) {
    return DEMO_BANNER_MESSAGES[orgSlug];
  }
  return DEFAULT_DEMO_BANNER_MESSAGE;
}
