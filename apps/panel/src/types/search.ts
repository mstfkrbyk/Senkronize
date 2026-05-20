export interface GlobalSearchProduct {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  imageUrls: string[];
}

export interface GlobalSearchOrder {
  id: string;
  platformOrderId: string;
  customerName: string;
  totalAmount: string | number;
  platform: string;
}

export interface GlobalSearchListing {
  id: string;
  barcode: string;
  title: string;
  platform: string;
}

export interface GlobalSearchResults {
  products: GlobalSearchProduct[];
  orders: GlobalSearchOrder[];
  listings: GlobalSearchListing[];
}

export type GlobalSearchResultType = 'product' | 'order' | 'listing';

export interface GlobalSearchHit {
  type: GlobalSearchResultType;
  id: string;
  label: string;
  subtitle: string;
  href: string;
}
