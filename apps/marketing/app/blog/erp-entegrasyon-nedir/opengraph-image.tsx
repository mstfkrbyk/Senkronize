import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'ERP entegrasyonu nedir — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage('ERP Entegrasyonu Nedir? E-Ticarette Neden Kritik?');
}
