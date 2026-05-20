import type { ListingStatus } from '@/types/listing';

const PLATFORM_SEARCH_URL: Record<string, (id: string, barcode: string) => string> =
  {
    TRENDYOL: (_id, barcode) =>
      `https://www.trendyol.com/sr?q=${encodeURIComponent(barcode)}`,
    HEPSIBURADA: (_id, barcode) =>
      `https://www.hepsiburada.com/ara?q=${encodeURIComponent(barcode)}`,
    N11: (_id, barcode) =>
      `https://www.n11.com/arama?q=${encodeURIComponent(barcode)}`,
    AMAZON_TR: (_id, barcode) =>
      `https://www.amazon.com.tr/s?k=${encodeURIComponent(barcode)}`,
    CICEKSEPETI: (_id, barcode) =>
      `https://www.ciceksepeti.com/arama?query=${encodeURIComponent(barcode)}`,
    PTTAVM: (_id, barcode) =>
      `https://www.pttavm.com/arama?q=${encodeURIComponent(barcode)}`,
    PAZARAMA: (_id, barcode) =>
      `https://www.pazarama.com/arama?q=${encodeURIComponent(barcode)}`,
  };

export function getListingPlatformUrl(
  platform: string,
  platformProductId: string,
  barcode: string,
): string | null {
  const builder = PLATFORM_SEARCH_URL[platform];
  if (builder) {
    return builder(platformProductId, barcode);
  }
  if (barcode.trim().length > 0) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${platform} ${barcode}`)}`;
  }
  return null;
}

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Devre dışı',
  OUT_OF_STOCK: 'Stok yok',
  PENDING: 'Beklemede',
};

export const LISTING_STATUS_CLASS: Record<ListingStatus, string> = {
  ACTIVE: 'border-green-200 bg-green-50 text-green-800',
  INACTIVE: 'border-slate-200 bg-slate-100 text-slate-700',
  OUT_OF_STOCK: 'border-red-200 bg-red-50 text-red-800',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-900',
};
