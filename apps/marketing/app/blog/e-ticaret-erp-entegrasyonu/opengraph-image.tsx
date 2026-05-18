import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'E-ticaret ERP entegrasyonu — Senkronize';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    'E-Ticaret ERP Entegrasyonu: Neden Önemli ve Nasıl Yapılır?',
  );
}
