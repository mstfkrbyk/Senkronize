import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Code2,
  Laptop,
  LayoutGrid,
  Package,
  Receipt,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

/** Ana sayfa özellik kartları */
export const FEATURES: {
  icon: LucideIcon;
  title: string;
  desc: string;
}[] = [
  {
    icon: Zap,
    title: 'Anlık Senkronizasyon',
    desc: 'Webhook ve anlık bildirimlerle stok, fiyat ve sipariş güncellemeleri tüm kanallara hızla yansır.',
  },
  {
    icon: Sparkles,
    title: 'BuyBox Optimizasyonu',
    desc: 'Yapay zekâ destekli fiyatlandırma kurallarıyla marjınızı koruyarak görünürlük kazanın.',
  },
  {
    icon: Package,
    title: 'Stok Yönetimi',
    desc: 'Çoklu depo desteği, rezervasyon ve otomatik düşük stok uyarıları tek panelde.',
  },
  {
    icon: BarChart3,
    title: 'Gelişmiş Raporlar',
    desc: 'Özelleştirilebilir PDF raporları; kanal, kategori ve dönem bazlı performans analizi.',
  },
  {
    icon: Laptop,
    title: 'Desktop Uygulaması',
    desc: 'Windows ve macOS için yerel ERP köprüsü; offline senaryolarda güvenli senkron.',
  },
  {
    icon: Code2,
    title: 'API Entegrasyonu',
    desc: 'REST API ve webhook desteği ile kendi sistemlerinizi Senkronize’a bağlayın.',
  },
];

/** Yıllık faturalama alt notu (ürün hatları + abonelik planları) */
export const PRICING_BILLING_NOTE = 'Yıllık faturalama (KDV hariç)';

/** Abonelik planı — limit fiyatları henüz yayınlanmadı */
export const PRICING_PLAN_STATUS_SOON = 'Erken erişim';
export const PRICING_PLAN_PRICE_SOON = 'Yıllık fiyat duyurulacak';
export const PRICING_PLAN_CTA_SOON = 'Erken kayıt';

/** Ürün hattı — kayıtta seçilebilir */
export const PRICING_PRODUCT_LINE_ON_SALE = 'Satışta';

export const PRICING_ENTERPRISE_STATUS = 'Bize Ulaşın';
export const PRICING_ENTERPRISE_PRICE = 'Özel';

/** Fiyatlandırma sayfası ve teaser — kısa UI metinleri */
export const PRICING_PAGE_COPY = {
  homepageTeaserLead:
    'Abonelik plan fiyatları duyurulmadan önce erken erişim listesine katılın.',
  earlyAccessTitle: 'Erken erişim listesi',
  earlyAccessBody: 'Kayıt olun; plan fiyatları ve lansman haberi size iletilsin.',
  productLinesLead:
    'Entegrasyon, Ön Muhasebe veya Paket. Limitler alttaki abonelik planlarında.',
  bundleRecommended: 'Önerilen',
} as const;

/** Ana sayfa teaser fiyatlandırma kartları */
export const HOMEPAGE_PRICING_TEASER: {
  name: string;
  status: string;
  description: string;
  cta: string;
  href: string;
  highlighted?: boolean;
}[] = [
  {
    name: 'Başlangıç',
    status: PRICING_PLAN_STATUS_SOON,
    description: '500 sipariş/ay, 1 pazaryeri, 1 ERP, 2 kullanıcı.',
    cta: 'Erken Kayıt',
    href: '/pricing',
  },
  {
    name: 'Gelişim',
    status: PRICING_PLAN_STATUS_SOON,
    description: '2.000 sipariş/ay, 3 pazaryeri, 2 ERP, 5 kullanıcı.',
    cta: 'Erken Kayıt',
    href: '/pricing',
    highlighted: true,
  },
  {
    name: 'Pro',
    status: PRICING_PLAN_STATUS_SOON,
    description: '10.000 sipariş/ay, BuyBox AI ve partner araçları.',
    cta: 'Erken Kayıt',
    href: '/pricing',
  },
  {
    name: 'Kurumsal',
    status: PRICING_ENTERPRISE_STATUS,
    description: 'Sınırsız kapasite, özel entegrasyon ve SLA.',
    cta: PRICING_ENTERPRISE_STATUS,
    href: '/contact',
  },
];

/** /features sayfası — detaylı bölümler */
export const FEATURE_PAGE_SECTIONS: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Zap,
    title: 'Gerçek Zamanlı Senkronizasyon',
    description:
      'Webhook tabanlı mimari ile stok ve fiyat değişiklikleri saniyeler içinde pazaryerlerine iletilir. Periyodik tarama yerine anlık tetikleyicilerle operasyon yükünüz azalır.',
  },
  {
    icon: LayoutGrid,
    title: 'Tüm Pazaryerlerinde Tek Panel',
    description:
      'Trendyol, Hepsiburada, N11, Çiçeksepeti, Amazon.com.tr, PTT AVM ve 10+ entegrasyonu tek arayüzden yönetin. Sipariş, iade ve katalog akışları merkezileşir.',
  },
  {
    icon: Receipt,
    title: 'Otomatik ERP Entegrasyonu',
    description:
      'Sipariş onaylandığında faturalama ve muhasebe kayıtları BizimHesap, Paraşüt, Logo Tiger, Mikro ERP ve Luca gibi sistemlere otomatik düşer; manuel veri girişi ortadan kalkar.',
  },
  {
    icon: Sparkles,
    title: 'AI BuyBox Optimizasyonu',
    description:
      'PRO planda yapay zekâ destekli fiyat önerileri, rakip ve marj kurallarıyla BuyBox’ı hedeflerken kârlılığınızı korursunuz.',
  },
  {
    icon: Users,
    title: 'Partner / Bayi Sistemi',
    description:
      'Ajanslar ve çözüm ortakları müşteri organizasyonlarına güvenli erişimle hizmet verir. İzlenebilirlik ve denetim için yetkilendirme katmanları hazırdır.',
  },
  {
    icon: Laptop,
    title: 'Masaüstü Uygulaması',
    description:
      'Masaüstü uygulama, şirket içi ERP ve kapalı ağ senaryolarında güvenli köprü sağlar; bulut paneli ile birlikte çalışır.',
  },
];

/** Fiyatlandırma sayfası — ürün hattı kartları (panel `product-selection` ile uyumlu) */
export interface PricingProductLine {
  id: 'integration' | 'accounting';
  name: string;
  description: string;
  features: readonly string[];
  /** Kart fiyat satırı (ör. Satışta) */
  priceLabel: string;
  billingNote: string;
  /** Stok menü konumu — panel kayıt önizlemesi (`product-selection-preview`) */
  stockNote?: string;
}

export const PRICING_PRODUCT_LINES: readonly PricingProductLine[] = [
  {
    id: 'integration',
    name: 'Entegrasyon',
    description: 'Pazaryeri, e-ticaret ve sipariş–stok senkronizasyonu.',
    features: [
      'Pazaryeri bağlantıları',
      'Sipariş ve iade akışı',
      'Gerçek zamanlı stok senkronu',
      'ERP köprüsü ve masaüstü ajan',
    ],
    priceLabel: PRICING_PRODUCT_LINE_ON_SALE,
    billingNote: PRICING_BILLING_NOTE,
    stockNote:
      'Stok menüsünde E-Ticaret bölümünden pazaryeri senkronu ve depo yönetimini yaparsınız.',
  },
  {
    id: 'accounting',
    name: 'Ön Muhasebe',
    description: 'Yerel fatura, cari hesap ve KDV yönetimi — harici ERP zorunlu değil.',
    features: [
      'Fatura oluşturma ve numaralandırma',
      'Cari hesap ve ekstre',
      'KDV özeti ve raporlama',
      'BizimHesap, Paraşüt köprüsü',
    ],
    priceLabel: PRICING_PRODUCT_LINE_ON_SALE,
    billingNote: PRICING_BILLING_NOTE,
    stockNote:
      'Yerleşik ön muhasebe modunda stok, Ön Muhasebe menüsünde listelenir; depo ve envanter buradan yönetilir.',
  },
] as const;

export const PRICING_BUNDLE_OFFER = {
  name: 'Paket',
  description:
    'Ön Muhasebe ve Entegrasyon tek panelde; yıllık faturalamada iki hat birlikte alındığında indirim uygulanır.',
  discountLabel: '%20 indirimli',
  features: ['Fatura ve cari', 'Pazaryeri ve sipariş', 'Tek panel ve raporlama'],
  priceLabel: PRICING_PRODUCT_LINE_ON_SALE,
  billingNote: PRICING_BILLING_NOTE,
  stockNote:
    'Pakette stok Ön Muhasebe menüsünde; sipariş ve pazaryeri işlemleri E-Ticaret menüsündedir.',
} as const;

/** Ana sayfa hero altı — kısa ürün hattı kartları */
export type HomepageProductLineId = 'integration' | 'accounting' | 'bundle';

export interface HomepageProductLineCard {
  id: HomepageProductLineId;
  name: string;
  description: string;
  badge?: string;
  href: string;
}

export const HOMEPAGE_PRODUCT_LINE_CARDS: readonly HomepageProductLineCard[] = [
  {
    id: 'integration',
    name: PRICING_PRODUCT_LINES[0].name,
    description: 'Pazaryeri, sipariş ve stok senkronu tek panelde.',
    href: '/pricing',
  },
  {
    id: 'accounting',
    name: PRICING_PRODUCT_LINES[1].name,
    description: 'Fatura, cari ve KDV — harici ERP zorunlu değil.',
    href: '/pricing',
  },
  {
    id: 'bundle',
    name: PRICING_BUNDLE_OFFER.name,
    description: 'Entegrasyon ve Ön Muhasebe birlikte; yıllık faturalamada indirim.',
    badge: PRICING_BUNDLE_OFFER.discountLabel,
    href: '/pricing',
  },
] as const;

export interface Plan {
  name: string;
  /** Kart üstü durum etiketi */
  status: string;
  /** Fiyat satırı (erken erişim veya Özel) */
  priceLabel: string;
  /** Yıllık faturalama notu */
  billingNote: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  highlighted: boolean;
  badge?: string;
  /** Kurumsal — özel teklif akışı */
  isEnterprise?: boolean;
}

export const PLANS: Plan[] = [
  {
    name: 'Başlangıç',
    status: PRICING_PLAN_STATUS_SOON,
    priceLabel: PRICING_PLAN_PRICE_SOON,
    billingNote: PRICING_BILLING_NOTE,
    features: [
      '500 sipariş / ay',
      '1 pazaryeri bağlantısı',
      '1 ERP bağlantısı',
      '2 kullanıcı',
      'Temel stok senkronizasyonu',
      'E-posta desteği',
    ],
    cta: PRICING_PLAN_CTA_SOON,
    highlighted: false,
  },
  {
    name: 'Gelişim',
    status: PRICING_PLAN_STATUS_SOON,
    priceLabel: PRICING_PLAN_PRICE_SOON,
    billingNote: PRICING_BILLING_NOTE,
    features: [
      '2.000 sipariş / ay',
      '3 pazaryeri bağlantısı',
      '2 ERP bağlantısı',
      '5 kullanıcı',
      'Gerçek zamanlı webhook senkronizasyonu',
      'Öncelikli destek ve raporlama',
    ],
    cta: PRICING_PLAN_CTA_SOON,
    highlighted: true,
    badge: 'En Popüler',
  },
  {
    name: 'Pro',
    status: PRICING_PLAN_STATUS_SOON,
    priceLabel: PRICING_PLAN_PRICE_SOON,
    billingNote: PRICING_BILLING_NOTE,
    features: [
      '10.000 sipariş / ay',
      '10 pazaryeri bağlantısı',
      '3 ERP bağlantısı',
      '15 kullanıcı',
      'BuyBox AI optimizasyonu',
      'Partner / bayi sistemi ve API erişimi',
    ],
    cta: PRICING_PLAN_CTA_SOON,
    highlighted: false,
  },
  {
    name: 'Kurumsal',
    status: PRICING_ENTERPRISE_STATUS,
    priceLabel: PRICING_ENTERPRISE_PRICE,
    billingNote: 'Sözleşmeli kurulum ve SLA',
    features: [
      'Sınırsız sipariş ve kanal',
      'Özel entegrasyon danışmanlığı',
      'Dedicated SLA ve destek',
      'Gelişmiş güvenlik ve denetim',
      'E-fatura ve kurumsal faturalama',
    ],
    cta: PRICING_ENTERPRISE_STATUS,
    ctaHref: '/contact',
    highlighted: false,
    isEnterprise: true,
  },
];

/** Fiyat karşılaştırma tablosu hücre tipleri */
export type ComparisonCell = 'check' | 'dash' | string;

export type PlanColumnKey = 'baslangic' | 'gelisim' | 'pro' | 'kurumsal';

export interface PricingComparisonRow {
  label: string;
  baslangic: ComparisonCell;
  gelisim: ComparisonCell;
  pro: ComparisonCell;
  kurumsal: ComparisonCell;
}

export const PRICING_COMPARISON: PricingComparisonRow[] = [
  {
    label: 'Sipariş / ay',
    baslangic: '500',
    gelisim: '2.000',
    pro: '10.000',
    kurumsal: 'Sınırsız',
  },
  {
    label: 'Pazaryeri bağlantısı',
    baslangic: '1',
    gelisim: '3',
    pro: '10',
    kurumsal: 'Sınırsız',
  },
  {
    label: 'ERP bağlantısı',
    baslangic: '1',
    gelisim: '2',
    pro: '3',
    kurumsal: 'Sınırsız',
  },
  {
    label: 'Kullanıcı',
    baslangic: '2',
    gelisim: '5',
    pro: '15',
    kurumsal: 'Sınırsız',
  },
  {
    label: 'Gerçek zamanlı webhook senk.',
    baslangic: 'dash',
    gelisim: 'check',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'Raporlama',
    baslangic: 'dash',
    gelisim: 'check',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'BuyBox AI',
    baslangic: 'dash',
    gelisim: 'dash',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'Partner / bayi sistemi',
    baslangic: 'dash',
    gelisim: 'dash',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'API erişimi',
    baslangic: 'dash',
    gelisim: 'dash',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'Özel entegrasyon',
    baslangic: 'dash',
    gelisim: 'dash',
    pro: 'dash',
    kurumsal: 'check',
  },
  {
    label: 'SLA',
    baslangic: 'dash',
    gelisim: 'dash',
    pro: 'dash',
    kurumsal: 'check',
  },
  {
    label: '14 gün ücretsiz deneme',
    baslangic: 'check',
    gelisim: 'check',
    pro: 'check',
    kurumsal: 'dash',
  },
];

export const TESTIMONIALS: {
  name: string;
  title: string;
  company: string;
  text: string;
}[] = [
  {
    name: 'Ahmet Yılmaz',
    title: 'E-ticaret Müdürü',
    company: 'Moda Tekstil A.Ş.',
    text: 'Senkronize ile stok yönetiminde harcadığımız süreyi %80 azalttık.',
  },
  {
    name: 'Fatma Kaya',
    title: 'Dijital Pazarlama Direktörü',
    company: 'Elektronik Dünyası',
    text: 'BuyBox optimizasyonu sayesinde satışlarımız ilk ayda %35 arttı.',
  },
  {
    name: 'Mehmet Demir',
    title: 'E-ticaret Ajans Sahibi',
    company: 'DigitalCommerce',
    text: 'Partner paneli ile 20 müşterimi tek panel üzerinden yönetiyorum.',
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: 'Ürün hattı ile abonelik planı arasındaki fark nedir?',
    a: 'Entegrasyon ve Ön Muhasebe ürün hatlarını ayrı ayrı veya indirimli Paket olarak seçersiniz. Başlangıç, Gelişim, Pro ve Kurumsal abonelik planları ise sipariş, pazaryeri bağlantısı ve kullanıcı limitlerini belirler.',
  },
  {
    q: '14 gün ücretsiz deneme nasıl çalışır?',
    a: 'Kayıt sonrası 14 gün boyunca seçtiğiniz abonelik planının özelliklerini deneyebilirsiniz. Kredi kartı gerekmez; süre bitiminde ücretlendirme için sizden onay alınır.',
  },
  {
    q: 'Fiyatlar nasıl faturalanıyor?',
    a: 'Tüm abonelik planları yıllık faturalama ile sunulur; gösterilen tutar yıllık ücrettir (KDV hariç). Aylık eşdeğer tutarlar yalnızca karşılaştırma amaçlıdır.',
  },
  {
    q: 'Hangi pazaryeri ve ERP’ler destekleniyor?',
    a: 'Trendyol, Hepsiburada, N11, Çiçeksepeti, Amazon.com.tr, PTT AVM; T-Soft, Ticimax, WooCommerce, Shopify, İdeasoft; BizimHesap, Paraşüt, Logo Tiger, Mikro ERP, Luca ve daha fazlası için entegrasyon yol haritası mevcuttur.',
  },
  {
    q: 'Aboneliği iptal edebilir miyim?',
    a: 'Evet. İstediğiniz zaman iptal edebilirsiniz; dönem sonuna kadar hizmetiniz açık kalır.',
  },
  {
    q: 'AI BuyBox hangi planda?',
    a: 'AI destekli BuyBox optimizasyonu Pro ve Kurumsal planlarda sunulur.',
  },
  {
    q: 'Kurumsal faturalama yapılıyor mu?',
    a: 'Kurumsal müşterilerimize e-fatura ve sözleşmeli kurulum seçenekleri sunulmaktadır.',
  },
];
