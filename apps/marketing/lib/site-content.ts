import type { LucideIcon } from 'lucide-react';
import {
  Laptop,
  LayoutGrid,
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
    title: 'Gerçek Zamanlı Senkronizasyon',
    desc: 'Webhook tabanlı stok ve fiyat güncellemeleri saniyeler içinde tüm kanallara yansır.',
  },
  {
    icon: LayoutGrid,
    title: 'Tüm Pazaryerlerinde Tek Panel',
    desc: 'Trendyol, Hepsiburada, N11 ve daha fazlası — sipariş ve operasyon tek ekranda.',
  },
  {
    icon: Receipt,
    title: 'Otomatik ERP Faturalama',
    desc: 'Sipariş oluştuğunda BizimHesap, Paraşüt, Logo Tiger ve diğer ERP’lere otomatik aktarım.',
  },
  {
    icon: Sparkles,
    title: 'AI BuyBox Optimizasyonu',
    desc: 'PRO planda rekabetçi fiyat ve kâr koruma kurallarıyla BuyBox şansınızı artırın.',
  },
  {
    icon: Users,
    title: 'Partner / Bayi Sistemi',
    desc: 'Ajanslar müşteri hesaplarını güvenli şekilde yönetir; beyaz etiket ile kendi markanızla sunun.',
  },
  {
    icon: Laptop,
    title: 'Tauri Masaüstü Köprüsü',
    desc: 'On‑premise ERP ve yerel ağlar için Windows ve macOS masaüstü uygulaması ile güvenli bağlantı.',
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
  /** Aylık liste fiyatı (KDV hariç) */
  monthlyPrice: number;
  period: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    name: 'Başlangıç',
    monthlyPrice: 799,
    period: '/ay',
    features: [
      '1 pazaryeri bağlantısı',
      '500 sipariş / ay',
      'Temel stok senkronizasyonu',
      '1 kullanıcı',
      'E-posta desteği',
    ],
    cta: 'Ücretsiz Deneyin',
    highlighted: false,
  },
  {
    name: 'Büyüme',
    monthlyPrice: 1499,
    period: '/ay',
    features: [
      '5 pazaryeri bağlantısı',
      '5.000 sipariş / ay',
      'Gerçek zamanlı webhook senkronizasyonu',
      '1 ERP bağlantısı',
      '5 kullanıcı',
      'Öncelikli destek',
      'Raporlama',
    ],
    cta: 'Ücretsiz Deneyin',
    highlighted: true,
    badge: 'En Popüler',
  },
  {
    name: 'Pro',
    monthlyPrice: 2999,
    period: '/ay',
    features: [
      'Sınırsız pazaryeri bağlantısı',
      'Sınırsız sipariş',
      'AI BuyBox optimizasyonu',
      'Sınırsız ERP bağlantısı',
      'Sınırsız kullanıcı',
      'Partner / bayi sistemi',
      'API erişimi',
      '7/24 öncelikli destek',
    ],
    cta: 'Ücretsiz Deneyin',
    highlighted: false,
  },
];

/** Fiyat karşılaştırma tablosu hücre tipleri */
export type ComparisonCell = 'check' | 'dash' | string;

export interface PricingComparisonRow {
  label: string;
  baslangic: ComparisonCell;
  buyume: ComparisonCell;
  pro: ComparisonCell;
}

export const PRICING_COMPARISON: PricingComparisonRow[] = [
  {
    label: 'Pazaryeri bağlantısı',
    baslangic: '1',
    buyume: '5',
    pro: 'Sınırsız',
  },
  {
    label: 'Sipariş / ay',
    baslangic: '500',
    buyume: '5.000',
    pro: 'Sınırsız',
  },
  {
    label: 'Gerçek zamanlı webhook senk.',
    baslangic: 'dash',
    buyume: 'check',
    pro: 'check',
  },
  {
    label: 'ERP bağlantısı',
    baslangic: 'dash',
    buyume: '1',
    pro: 'Sınırsız',
  },
  {
    label: 'Kullanıcı',
    baslangic: '1',
    buyume: '5',
    pro: 'Sınırsız',
  },
  {
    label: 'Raporlama',
    baslangic: 'dash',
    buyume: 'check',
    pro: 'check',
  },
  {
    label: 'AI BuyBox optimizasyonu',
    baslangic: 'dash',
    buyume: 'dash',
    pro: 'check',
  },
  {
    label: 'Partner / bayi sistemi',
    baslangic: 'dash',
    buyume: 'dash',
    pro: 'check',
  },
  {
    label: 'API erişimi',
    baslangic: 'dash',
    buyume: 'dash',
    pro: 'check',
  },
  {
    label: 'Destek',
    baslangic: 'E-posta',
    buyume: 'Öncelikli',
    pro: '7/24 öncelikli',
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
    q: 'Yıllık faturalamada %20 indirim nasıl uygulanır?',
    a: 'Yıllık ödeme seçildiğinde aylık liste fiyatına göre %20 indirimli eşdeğer aylık tutar gösterilir; toplam tutar yıllık faturalanır. Fiyatlar KDV hariçtir.',
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
    a: 'AI destekli BuyBox optimizasyonu Pro planda sunulur. Büyüme planında gelişmiş webhook senkronizasyonu ve raporlama yer alır.',
  },
  {
    q: 'Kurumsal faturalama yapılıyor mu?',
    a: 'Kurumsal müşterilerimize e-fatura ve sözleşmeli kurulum seçenekleri sunulmaktadır.',
  },
];

