import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Hepsiburada mağaza büyüme — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage('Hepsiburada Mağazanızı Büyütmenin 7 Yolu');
}
