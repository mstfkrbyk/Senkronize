import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Code2,
  Laptop,
  Package,
  Sparkles,
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
    name: 'Starter',
    status: 'Yakında',
    description: 'Küçük işletmeler için temel pazaryeri senkronizasyonu.',
    cta: 'Bildirim Al',
    href: '/contact',
  },
  {
    name: 'Pro',
    status: 'Yakında',
    description: 'Büyüyen markalar için AI BuyBox ve gelişmiş otomasyon.',
    cta: 'Bildirim Al',
    href: '/contact',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    status: 'Özel teklif',
    description: 'Yüksek hacim, SLA ve özel entegrasyon ihtiyaçları.',
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
  /** Yıllık fiyat (KDV hariç), TRY */
  yearlyPrice: number;
  /** Aylık eşdeğer gösterimi için (yıllık / 12, yuvarlanmış) */
  monthlyEquivalent: number;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}

function monthlyEq(yearly: number): number {
  return Math.round(yearly / 12);
}

export const PLANS: Plan[] = [
  {
    name: 'Başlangıç',
    yearlyPrice: 2900,
    monthlyEquivalent: monthlyEq(2900),
    features: [
      '1 pazaryeri bağlantısı',
      '500 sipariş / ay',
      'Temel stok senkronizasyonu',
      '2 kullanıcı',
      'E-posta desteği',
    ],
    cta: '14 Gün Ücretsiz Dene',
    highlighted: false,
  },
  {
    name: 'Gelişim',
    yearlyPrice: 5900,
    monthlyEquivalent: monthlyEq(5900),
    features: [
      '3 pazaryeri bağlantısı',
      '2.000 sipariş / ay',
      'Gerçek zamanlı webhook senkronizasyonu',
      '2 ERP bağlantısı',
      '5 kullanıcı',
      'Öncelikli destek',
      'Raporlama',
    ],
    cta: '14 Gün Ücretsiz Dene',
    highlighted: true,
    badge: 'En Popüler',
  },
  {
    name: 'Pro',
    yearlyPrice: 9900,
    monthlyEquivalent: monthlyEq(9900),
    features: [
      '10 pazaryeri bağlantısı',
      '10.000 sipariş / ay',
      'AI BuyBox optimizasyonu',
      '3 ERP bağlantısı',
      '15 kullanıcı',
      'Partner / bayi sistemi',
      'API erişimi',
      '7/24 öncelikli destek',
    ],
    cta: '14 Gün Ücretsiz Dene',
    highlighted: false,
  },
  {
    name: 'Kurumsal',
    yearlyPrice: 19_900,
    monthlyEquivalent: monthlyEq(19_900),
    features: [
      '50 pazaryeri bağlantısı',
      '100.000 sipariş / ay',
      'Gelişmiş güvenlik ve SLA',
      '10 ERP bağlantısı',
      '100 kullanıcı',
      'Özel entegrasyon danışmanlığı',
      'Sözleşmeli kurulum ve e-fatura',
    ],
    cta: '14 Gün Ücretsiz Dene',
    highlighted: false,
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
    label: 'Pazaryeri bağlantısı',
    baslangic: '1',
    gelisim: '3',
    pro: '10',
    kurumsal: '50',
  },
  {
    label: 'Sipariş / ay',
    baslangic: '500',
    gelisim: '2.000',
    pro: '10.000',
    kurumsal: '100.000',
  },
  {
    label: 'Gerçek zamanlı webhook senk.',
    baslangic: 'dash',
    gelisim: 'check',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'ERP bağlantısı',
    baslangic: '1',
    gelisim: '2',
    pro: '3',
    kurumsal: '10',
  },
  {
    label: 'Kullanıcı',
    baslangic: '2',
    gelisim: '5',
    pro: '15',
    kurumsal: '100',
  },
  {
    label: 'Raporlama',
    baslangic: 'dash',
    gelisim: 'check',
    pro: 'check',
    kurumsal: 'check',
  },
  {
    label: 'AI BuyBox optimizasyonu',
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
    label: 'Destek',
    baslangic: 'E-posta',
    gelisim: 'Öncelikli',
    pro: '7/24 öncelikli',
    kurumsal: 'Dedicated',
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
