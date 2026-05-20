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

export type ListingStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'PENDING';

export type ListingSort =
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'updated_desc';

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
  isActive: boolean;
  status: ListingStatus;
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
  status?: ListingStatus;
  approved?: boolean;
  stockTier?: ListingStockTier;
  minSalePrice?: number;
  maxSalePrice?: number;
  priceMin?: number;
  priceMax?: number;
  stockMin?: number;
  stockMax?: number;
  lastSyncAtSince?: string;
  lastSyncAtUntil?: string;
  category?: string;
  search?: string;
  sort?: ListingSort;
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

export interface ListingSyncError {
  id: string;
  action: string;
  message: string;
  createdAt: string;
}

export interface ListingDetailResponse {
  listing: Listing;
  category: string | null;
  priceHistory: ListingDetailPricePoint[];
  buyBox: ListingDetailBuyBox | null;
  syncErrors: ListingSyncError[];
}

export interface BulkResult {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
}
