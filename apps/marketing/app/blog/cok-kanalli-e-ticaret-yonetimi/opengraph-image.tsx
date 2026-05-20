import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Çok kanallı e-ticaret yönetimi — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage('Çok Kanallı E-Ticaret Yönetimi: Neden ve Nasıl?');
}
