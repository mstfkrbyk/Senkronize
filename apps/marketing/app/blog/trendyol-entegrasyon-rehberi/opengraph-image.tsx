import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Trendyol entegrasyon rehberi — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage('Trendyol Entegrasyonu: Kapsamlı Satıcı Rehberi 2025');
}
