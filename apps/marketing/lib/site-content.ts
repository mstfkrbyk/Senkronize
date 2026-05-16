import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Package,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

export const FEATURES: {
  icon: LucideIcon;
  title: string;
  desc: string;
}[] = [
  {
    icon: Zap,
    title: 'Gerçek Zamanlı Sync',
    desc: 'Stok ve fiyat değişiklikleri anında tüm kanallara yansır.',
  },
  {
    icon: TrendingUp,
    title: 'BuyBox Optimizasyonu',
    desc: 'AI destekli fiyatlandırma ile rakiplerinizin önüne geçin.',
  },
  {
    icon: Package,
    title: 'Merkezi Stok',
    desc: 'Tüm pazaryerlerindeki stoğunuzu tek noktadan görün ve yönetin.',
  },
  {
    icon: BarChart2,
    title: 'Detaylı Raporlar',
    desc: 'Satış analizleri ve trend raporları ile kararlarınızı veriye dayandırın.',
  },
  {
    icon: Users,
    title: 'Partner Sistemi',
    desc: 'Ajanslar için özel panel — müşterilerinizi tek yerden yönetin.',
  },
  {
    icon: Shield,
    title: 'Güvenli & KVKK Uyumlu',
    desc: 'Verileriniz TR sunucularında, AES-256 şifreleme ile korunur.',
  },
];

export interface Plan {
  name: string;
  price: number;
  period: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    name: 'Başlangıç',
    price: 499,
    period: '/ay',
    features: [
      '2 pazaryeri bağlantısı',
      '500 ürün',
      'Manuel senkronizasyon',
      'E-posta desteği',
    ],
    cta: 'Başlayın',
    highlighted: false,
  },
  {
    name: 'Gelişim',
    price: 999,
    period: '/ay',
    features: [
      '5 pazaryeri',
      '2.000 ürün',
      'Otomatik senkronizasyon',
      'ERP entegrasyonu',
      'Öncelikli destek',
    ],
    cta: 'Başlayın',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 1999,
    period: '/ay',
    features: [
      'Sınırsız pazaryeri',
      'Sınırsız ürün',
      'BuyBox optimizasyonu',
      'AI fiyatlandırma',
      '7/24 destek',
      'Özel müdür',
    ],
    cta: '14 Gün Ücretsiz Dene',
    highlighted: true,
    badge: 'En Popüler',
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
    q: 'Deneme süresi nasıl işliyor?',
    a: '14 gün boyunca tüm özelliklere erişebilirsiniz. Kredi kartı gerekmez.',
  },
  {
    q: 'Aboneliği iptal edebilir miyim?',
    a: 'İstediğiniz zaman iptal edebilirsiniz. İptal sonrası dönem bitimine kadar hizmet açık kalır.',
  },
  {
    q: 'ERP entegrasyonu hangi plandan itibaren?',
    a: 'Gelişim planından itibaren BizimHesap ve T-Soft entegrasyonu mevcuttur.',
  },
  {
    q: 'Fatura kesilebiliyor mu?',
    a: 'Evet, kurumsal müşterilerimize e-fatura kesilmektedir.',
  },
];
