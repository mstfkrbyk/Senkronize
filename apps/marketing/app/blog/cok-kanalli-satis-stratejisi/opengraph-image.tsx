import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Çok kanallı satış stratejisi — Senkronize';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    "Çok Kanallı Satış: Trendyol, Hepsiburada, N11'de Başarı",
  );
}
