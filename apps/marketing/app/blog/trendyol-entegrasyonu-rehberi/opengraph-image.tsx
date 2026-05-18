import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Trendyol entegrasyonu — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    'Trendyol Entegrasyonunda Yapılan 7 Kritik Hata ve Çözümleri',
  );
}
