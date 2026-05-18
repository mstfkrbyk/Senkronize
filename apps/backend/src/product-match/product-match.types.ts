import type { Marketplace } from '@prisma/client';

export interface MatchResult {
  listingsProcessed: number;
  listingsLinked: number;
  newProductsCreated: number;
  newMatchesCreated: number;
  alreadyInSync: number;
}

export interface SimilarProduct {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  confidence: number;
}

export interface ProductMatchConflict {
  kind: 'LISTING_PRODUCT_VS_MATCH' | 'DUPLICATE_LISTING_PRODUCT';
  listingId: string;
  platform: Marketplace;
  barcode: string;
  listingProductId: string | null;
  matchMasterProductId: string | null;
  title: string;
}

export interface UnmatchedListingRow {
  id: string;
  platform: Marketplace;
  barcode: string;
  title: string;
  salePrice: string;
  listPrice: string;
  quantity: number;
  productId: string | null;
  platformProductId: string;
}
