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
    desc: 'WebSocket ve webhook ile stok, fiyat ve sipariş güncellemeleri sıfır gecikmeyle tüm kanallara yansır.',
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
    status: 'Yakında',
    description: '500 sipariş/ay, 1 pazaryeri, 1 ERP, 2 kullanıcı.',
    cta: 'Erken Kayıt',
    href: '/pricing',
  },
  {
    name: 'Gelişim',
    status: 'Yakında',
    description: '2.000 sipariş/ay, 3 pazaryeri, 2 ERP, 5 kullanıcı.',
    cta: 'Erken Kayıt',
    href: '/pricing',
    highlighted: true,
  },
  {
    name: 'Pro',
    status: 'Yakında',
    description: '10.000 sipariş/ay, BuyBox AI ve partner araçları.',
    cta: 'Erken Kayıt',
    href: '/pricing',
  },
  {
    name: 'Kurumsal',
    status: 'Bize Ulaşın',
    description: 'Sınırsız kapasite, özel entegrasyon ve SLA.',
    cta: 'Bize Ulaşın',
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
      'Tauri ile geliştirilen masaüstü uygulama, şirket içi ERP ve kapalı ağ senaryolarında güvenli köprü sağlar; bulut paneli ile birlikte çalışır.',
  },
];

export interface Plan {
  name: string;
  /** Kart üstü durum etiketi */
  status: string;
  /** Fiyat satırı (yakında: ₺X/ay veya Özel) */
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
    status: 'Yakında',
    priceLabel: '₺X/ay',
    billingNote: 'Yıllık faturalama (KDV hariç)',
    features: [
      '500 sipariş / ay',
      '1 pazaryeri bağlantısı',
      '1 ERP bağlantısı',
      '2 kullanıcı',
      'Temel stok senkronizasyonu',
      'E-posta desteği',
    ],
    cta: 'Yakında',
    highlighted: false,
  },
  {
    name: 'Gelişim',
    status: 'Yakında',
    priceLabel: '₺X/ay',
    billingNote: 'Yıllık faturalama (KDV hariç)',
    features: [
      '2.000 sipariş / ay',
      '3 pazaryeri bağlantısı',
      '2 ERP bağlantısı',
      '5 kullanıcı',
      'Gerçek zamanlı webhook senkronizasyonu',
      'Öncelikli destek ve raporlama',
    ],
    cta: 'Yakında',
    highlighted: true,
    badge: 'En Popüler',
  },
  {
    name: 'Pro',
    status: 'Yakında',
    priceLabel: '₺X/ay',
    billingNote: 'Yıllık faturalama (KDV hariç)',
    features: [
      '10.000 sipariş / ay',
      '10 pazaryeri bağlantısı',
      '3 ERP bağlantısı',
      '15 kullanıcı',
      'BuyBox AI optimizasyonu',
      'Partner / bayi sistemi ve API erişimi',
    ],
    cta: 'Yakında',
    highlighted: false,
  },
  {
    name: 'Kurumsal',
    status: 'Bize Ulaşın',
    priceLabel: 'Özel',
    billingNote: 'Sözleşmeli kurulum ve SLA',
    features: [
      'Sınırsız sipariş ve kanal',
      'Özel entegrasyon danışmanlığı',
      'Dedicated SLA ve destek',
      'Gelişmiş güvenlik ve denetim',
      'E-fatura ve kurumsal faturalama',
    ],
    cta: 'Bize Ulaşın',
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
    q: '14 gün ücretsiz deneme nasıl çalışır?',
    a: 'Kayıt sonrası 14 gün boyunca seçtiğiniz planın özelliklerini deneyebilirsiniz. Kredi kartı gerekmez; süre bitiminde ücretlendirme için sizden onay alınır.',
  },
  {
    q: 'Fiyatlar nasıl faturalanıyor?',
    a: 'Tüm paketler yıllık faturalama ile sunulur; gösterilen tutar yıllık ücrettir (KDV hariç). Aylık eşdeğer tutarlar yalnızca karşılaştırma amaçlıdır.',
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
