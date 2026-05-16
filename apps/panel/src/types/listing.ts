export type ListingPlatform = 'TRENDYOL' | 'HEPSIBURADA';

export interface Listing {
  id: string;
  platform: ListingPlatform;
  platformProductId: string;
  barcode: string;
  title: string;
  salePrice: string;
  listPrice: string;
  quantity: number;
  approved: boolean;
  imageUrls: string[];
  lastSyncAt: string | null;
  createdAt: string;
}

export interface ListingsResponse {
  items: Listing[];
  total: number;
}

export interface ListingSummary {
  total: number;
  approved: number;
  pending: number;
  byPlatform: Record<string, number>;
}

export interface ListingFilters {
  platform?: string;
  approved?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
