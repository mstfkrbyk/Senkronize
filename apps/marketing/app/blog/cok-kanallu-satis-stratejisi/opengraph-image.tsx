import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Omnichannel satış stratejisi — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    'Çok Kanallı Satış (Omnichannel) Stratejisi: Türk E-ticaret İçin Kapsamlı Kılavuz',
  );
}
