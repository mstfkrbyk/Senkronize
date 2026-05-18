export interface BlogPostListItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  readMinutes: number;
  author: string;
}

export const BLOG_POSTS: BlogPostListItem[] = [
  {
    slug: 'trendyol-entegrasyonu-rehberi',
    title: 'Trendyol Entegrasyonunda Yapılan 7 Kritik Hata ve Çözümleri',
    date: '18 Mayıs 2026',
    excerpt:
      'Trendyol API hataları, rate limiting ve stok senkronizasyonu tuzakları: sık yapılan hatalar ve sürdürülebilir çözüm önerileri.',
    readMinutes: 10,
    author: 'Senkronize Ekibi',
  },
  {
    slug: 'buybox-kazanma-stratejileri',
    title: "BuyBox'ı Kazanmanın 5 Altın Kuralı: Veri Odaklı Fiyatlandırma",
    date: '17 Mayıs 2026',
    excerpt:
      'BuyBox nedir, fiyat rekabeti, stok ve teslimat sinyalleri; otomatik fiyatlandırma ile marjınızı koruyarak görünürlük kazanın.',
    readMinutes: 10,
    author: 'Senkronize Ekibi',
  },
  {
    slug: 'coklu-kanal-satis-rehberi',
    title: 'Çoklu Kanal Satışta Başarının Sırrı: Merkezi Stok Yönetimi',
    date: '16 Mayıs 2026',
    excerpt:
      'Omnichannel satışta stok çakışması, çift satış riski ve otomatik senkronizasyon: Senkronize ile tek kaynak doğruluğu.',
    readMinutes: 10,
    author: 'Senkronize Ekibi',
  },
  {
    slug: 'trendyolda-buybox-nasil-kazanilir',
    title: "Trendyol'da BuyBox Nasıl Kazanılır? 2026 Rehberi",
    date: '15 Mayıs 2026',
    excerpt:
      'BuyBox nedir, hangi sinyalleri etkiler ve dinamik fiyatlandırma ile stok disiplinini nasıl birleştirirsiniz? Pratik bir rehber.',
    readMinutes: 8,
    author: 'Senkronize Ekibi',
  },
  {
    slug: 'e-ticaret-erp-entegrasyonu',
    title: 'E-Ticaret ERP Entegrasyonu: Neden Önemli ve Nasıl Yapılır?',
    date: '10 Mayıs 2026',
    excerpt:
      'ERP ile e-ticaret bağlantısı manuel iş yükünü azaltır, hata riskini düşürür ve ölçeklenebilir operasyon sağlar.',
    readMinutes: 7,
    author: 'Senkronize Ekibi',
  },
  {
    slug: 'cok-kanalli-satis-stratejisi',
    title:
      'Çok Kanallı Satış Stratejisi: Trendyol, Hepsiburada, N11\'de Başarı',
    date: '1 Mayıs 2026',
    excerpt:
      'Birden fazla pazaryerinde büyürken stok, fiyat ve operasyonu nasıl yönetirsiniz? Avantajlar ve tuzaklar.',
    readMinutes: 7,
    author: 'Senkronize Ekibi',
  },
];

export function getRelatedPosts(currentSlug: string): BlogPostListItem[] {
  return BLOG_POSTS.filter((p) => p.slug !== currentSlug).slice(0, 2);
}
