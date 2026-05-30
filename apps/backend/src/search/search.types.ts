export interface SearchProductResult {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  imageUrls: string[];
}

export interface SearchOrderResult {
  id: string;
  platformOrderId: string;
  customerName: string;
  totalAmount: unknown;
  platform: string;
}

export interface SearchListingResult {
  id: string;
  barcode: string;
  title: string;
  platform: string;
}

export interface SearchResults {
  products: SearchProductResult[];
  orders: SearchOrderResult[];
  listings: SearchListingResult[];
}
