export type BlogCategory = 'Rehber' | 'Strateji' | 'Teknik';

export interface BlogPostListItem {
  slug: string;
  title: string;
  date: string;
  dateIso: string;
  excerpt: string;
  readMinutes: number;
  author: string;
  category: BlogCategory;
  image?: string;
}

export const BLOG_POSTS_PER_PAGE = 6;

export const BLOG_POSTS: BlogPostListItem[] = [
  {
    slug: 'trendyol-entegrasyon-rehberi',
    title: 'Trendyol Mağaza Entegrasyonunun Eksiksiz Rehberi 2026',
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'Trendyol SP-API kurulumu, ürün yükleme, stok yönetimi, sipariş çekme ve sık karşılaşılan hatalar: 2026 eksiksiz entegrasyon rehberi.',
    readMinutes: 12,
    author: 'Senkronize',
    category: 'Rehber',
    image: '/images/blog/trendyol-guide.jpg',
  },
  {
    slug: 'coklu-kanal-satis-stratejileri',
    title: "2026'da Çok Kanallı Satışın 10 Altın Kuralı",
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'Omnichannel strateji, stok yönetimi, fiyatlandırma, BuyBox kazanımı ve performans ölçümü: çok kanallı satışın on altın kuralı.',
    readMinutes: 12,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'erp-entegrasyon-nedir',
    title: 'ERP Entegrasyonu Nedir? E-Ticarette Neden Kritik?',
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'ERP tanımı, pazaryeri-ERP köprüsü, Logo/Mikro/BizimHesap karşılaştırması ve ROI analizi: e-ticarette ERP entegrasyonu rehberi.',
    readMinutes: 12,
    author: 'Senkronize',
    category: 'Teknik',
  },
  {
    slug: 'e-ticarette-buybox-kazanma-stratejileri',
    title: 'E-Ticarette BuyBox Nasıl Kazanılır? 2026 Stratejileri',
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'BuyBox nedir, Trendyol vs Amazon farkı, fiyat-stok dengesi ve Senkronize ile otomatik optimizasyon — 2026 stratejileri.',
    readMinutes: 12,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'trendyol-hepsiburada-entegrasyon-rehberi',
    title: 'Trendyol ve Hepsiburada Entegrasyonu: Adım Adım Rehber',
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'API anahtarı alma, stok senkronizasyonu, sipariş yönetimi ve sorun giderme: iki büyük pazaryeri için pratik rehber.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Rehber',
  },
  {
    slug: 'cok-kanalli-e-ticaret-yonetimi',
    title: 'Çok Kanallı E-Ticaret Yönetimi: Neden ve Nasıl?',
    date: '20 Mayıs 2026',
    dateIso: '2026-05-20',
    excerpt:
      'Çok kanallı satışın nedenleri, entegrasyonsuz tuzaklar ve merkezi yönetimle sürdürülebilir büyüme.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'hepsiburada-magazanizi-buyutun',
    title: 'Hepsiburada Mağazanızı Büyütmenin 7 Yolu',
    date: '18 Mayıs 2026',
    dateIso: '2026-05-18',
    excerpt:
      'BuyBox optimizasyonu, fiyatlama, stok ipuçları ve otomatik entegrasyonla zaman tasarrufu: mağaza büyümesi için yedi başlık.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'cok-kanallu-satis-stratejisi',
    title:
      'Çok Kanallı Satış (Omnichannel) Stratejisi: Türk E-ticaret İçin Kapsamlı Kılavuz',
    date: '18 Mayıs 2026',
    dateIso: '2026-05-18',
    excerpt:
      'Omnichannel nedir, Türkiye kanalları, entegrasyonsuz çok kanallılığın tuzakları ve Senkronize ile merkezi yönetim.',
    readMinutes: 11,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'trendyol-entegrasyonu-rehberi',
    title: 'Trendyol Entegrasyonunda Yapılan 7 Kritik Hata ve Çözümleri',
    date: '18 Mayıs 2026',
    dateIso: '2026-05-18',
    excerpt:
      'Trendyol API hataları, rate limiting ve stok senkronizasyonu tuzakları: sık yapılan hatalar ve sürdürülebilir çözüm önerileri.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Rehber',
  },
  {
    slug: 'buybox-kazanma-stratejileri',
    title: "BuyBox'ı Kazanmanın 5 Altın Kuralı: Veri Odaklı Fiyatlandırma",
    date: '17 Mayıs 2026',
    dateIso: '2026-05-17',
    excerpt:
      'BuyBox nedir, fiyat rekabeti, stok ve teslimat sinyalleri; otomatik fiyatlandırma ile marjınızı koruyarak görünürlük kazanın.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'coklu-kanal-satis-rehberi',
    title: 'Çoklu Kanal Satışta Başarının Sırrı: Merkezi Stok Yönetimi',
    date: '16 Mayıs 2026',
    dateIso: '2026-05-16',
    excerpt:
      'Omnichannel satışta stok çakışması, çift satış riski ve otomatik senkronizasyon: Senkronize ile tek kaynak doğruluğu.',
    readMinutes: 10,
    author: 'Senkronize',
    category: 'Rehber',
  },
  {
    slug: 'trendyolda-buybox-nasil-kazanilir',
    title: "Trendyol'da BuyBox Nasıl Kazanılır? 2026 Rehberi",
    date: '15 Mayıs 2026',
    dateIso: '2026-05-15',
    excerpt:
      'BuyBox nedir, hangi sinyalleri etkiler ve dinamik fiyatlandırma ile stok disiplinini nasıl birleştirirsiniz? Pratik bir rehber.',
    readMinutes: 8,
    author: 'Senkronize',
    category: 'Strateji',
  },
  {
    slug: 'e-ticaret-erp-entegrasyonu',
    title: 'E-Ticaret ERP Entegrasyonu: Neden Önemli ve Nasıl Yapılır?',
    date: '10 Mayıs 2026',
    dateIso: '2026-05-10',
    excerpt:
      'ERP ile e-ticaret bağlantısı manuel iş yükünü azaltır, hata riskini düşürür ve ölçeklenebilir operasyon sağlar.',
    readMinutes: 7,
    author: 'Senkronize',
    category: 'Teknik',
  },
  {
    slug: 'cok-kanalli-satis-stratejisi',
    title:
      'Çok Kanallı Satış Stratejisi: Trendyol, Hepsiburada, N11\'de Başarı',
    date: '1 Mayıs 2026',
    dateIso: '2026-05-01',
    excerpt:
      'Birden fazla pazaryerinde büyürken stok, fiyat ve operasyonu nasıl yönetirsiniz? Avantajlar ve tuzaklar.',
    readMinutes: 7,
    author: 'Senkronize',
    category: 'Strateji',
  },
];

export function truncateExcerpt(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function getBlogPostsPage(page: number): {
  posts: BlogPostListItem[];
  totalPages: number;
  currentPage: number;
} {
  const safePage = Math.max(1, page);
  const totalPages = Math.max(1, Math.ceil(BLOG_POSTS.length / BLOG_POSTS_PER_PAGE));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * BLOG_POSTS_PER_PAGE;

  return {
    posts: BLOG_POSTS.slice(start, start + BLOG_POSTS_PER_PAGE),
    totalPages,
    currentPage,
  };
}

export function getRelatedPosts(currentSlug: string): BlogPostListItem[] {
  return BLOG_POSTS.filter((p) => p.slug !== currentSlug).slice(0, 2);
}

export const CATEGORY_STYLES: Record<BlogCategory, string> = {
  Rehber: 'bg-sky-100 text-sky-800',
  Strateji: 'bg-violet-100 text-violet-800',
  Teknik: 'bg-emerald-100 text-emerald-800',
};
