import { blogOpenGraphImage } from '@/lib/blog-og-image';

export const alt = 'Çoklu kanal satış — Senkronize Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return blogOpenGraphImage(
    'Çoklu Kanal Satışta Başarının Sırrı: Merkezi Stok Yönetimi',
  );
}
