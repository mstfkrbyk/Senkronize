export type ListingPlatform =
  | 'TRENDYOL'
  | 'HEPSIBURADA'
  | 'N11'
  | 'AMAZON_TR'
  | 'CICEKSEPETI'
  | 'IDEASOFT'
  | 'PTTAVM'
  | 'PAZARAMA'
  | 'TSOFT'
  | 'TICIMAX'
  | 'WOOCOMMERCE'
  | 'SHOPIFY';

/** Backend `ListingStockTier` ile uyumlu */
export type ListingStockTier = 'IN_STOCK' | 'LOW' | 'OUT';

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
  /** Virgülle birleştirilmiş çoklu platform (API `platforms`). */
  platforms?: string;
  approved?: boolean;
  stockTier?: ListingStockTier;
  minSalePrice?: number;
  maxSalePrice?: number;
  lastSyncAtSince?: string;
  lastSyncAtUntil?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListingDetailPricePoint {
  appliedAt: string;
  oldPrice: string;
  newPrice: string;
}

export interface ListingDetailBuyBox {
  isWinner: boolean;
  buyBoxPrice: string;
  ourPrice: string;
  capturedAt: string;
}

export interface ListingDetailResponse {
  listing: Listing;
  category: string | null;
  priceHistory: ListingDetailPricePoint[];
  buyBox: ListingDetailBuyBox | null;
}
