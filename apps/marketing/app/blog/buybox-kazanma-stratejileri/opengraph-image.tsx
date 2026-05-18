import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'BuyBox stratejileri — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    "BuyBox'ı Kazanmanın 5 Altın Kuralı: Veri Odaklı Fiyatlandırma",
  );
}
