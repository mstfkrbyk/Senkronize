export interface HepsiburadaListing {
  hepsiburadaSku: string;
  merchantSku: string;
  barcode: string;
  productName: string;
  availableStock: number;
  price: number;
  listPrice: number;
  isSalable: boolean;
  images: string[];
}

export interface HepsiburadaListingsResponse {
  data: {
    listings: HepsiburadaListing[];
    pageCount: number;
    totalCount: number;
  };
}

export interface HepsiburadaInventoryUploadItem {
  hepsiburadaSku: string;
  availableStock?: number;
  price?: number;
  listingPrice?: number;
}

export interface HepsiburadaOrderListItem {
  orderNumber?: string;
  orderId?: string;
  packageId?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  orderDate?: string;
  totalAmount?: number;
  currency?: string;
  cargoCompanyName?: string;
  trackingNumber?: string;
  lines?: HepsiburadaOrderLine[];
  items?: HepsiburadaOrderLine[];
}

export interface HepsiburadaOrderLine {
  hepsiburadaSku?: string;
  merchantSku?: string;
  sku?: string;
  barcode?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  listingPrice?: number;
}

export interface HepsiburadaOrderListResponse {
  orders?: HepsiburadaOrderListItem[];
  content?: HepsiburadaOrderListItem[];
  totalElements?: number;
  totalCount?: number;
}

export interface HepsiburadaOrderSummary {
  orderNumber?: string;
  orderId?: string;
  packageId?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  orderDate?: string;
  totalAmount?: number;
  currency?: string;
  cargoCompanyName?: string;
  trackingNumber?: string;
  lines?: HepsiburadaOrderLine[];
  items?: HepsiburadaOrderLine[];
}

export interface HepsiburadaOrderSummariesResponse {
  summaries?: HepsiburadaOrderSummary[];
  orders?: HepsiburadaOrderSummary[];
  content?: HepsiburadaOrderSummary[];
  totalCount?: number;
}

export interface HepsiburadaMerchantProduct {
  hepsiburadaSku?: string;
  merchantSku?: string;
  barcode?: string;
  productName?: string;
  name?: string;
  availableStock?: number;
  quantity?: number;
  price?: number;
  listPrice?: number;
  salePrice?: number;
  isSalable?: boolean;
  images?: string[];
}

export interface HepsiburadaMerchantProductsResponse {
  products?: HepsiburadaMerchantProduct[];
  merchantProducts?: HepsiburadaMerchantProduct[];
  content?: HepsiburadaMerchantProduct[];
  totalCount?: number;
  totalElements?: number;
}

export interface HepsiburadaBatchListingItem {
  hepsiburadaSku: string;
  merchantSku?: string;
  availableStock?: number;
  price?: string | number;
  salePrice?: string | number;
}

export interface HepsiburadaBatchRequestResponse {
  batchRequestId?: string;
  id?: string;
  batchId?: string;
}

export interface HepsiburadaBatchRequestStatus {
  batchRequestId?: string;
  id?: string;
  status?: string;
  processingStatus?: string;
  failedCount?: number;
  successCount?: number;
  totalCount?: number;
  errors?: Array<{ hepsiburadaSku?: string; message?: string }>;
}

export interface HepsiburadaMpopPackage {
  packageNumber?: string;
  packageId?: string;
  orderNumber?: string;
  status?: string;
  cargoCompanyCode?: string;
  trackingNumber?: string;
  lines?: HepsiburadaOrderLine[];
  items?: HepsiburadaOrderLine[];
}

export interface HepsiburadaMpopPackagesResponse {
  packages?: HepsiburadaMpopPackage[];
  content?: HepsiburadaMpopPackage[];
  totalCount?: number;
}

export interface HepsiburadaPackageDetail {
  packageId?: string;
  orderNumber?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  currency?: string;
  orderDate?: string;
  cargoCompanyName?: string;
  trackingNumber?: string;
  lines?: HepsiburadaOrderLine[];
  items?: HepsiburadaOrderLine[];
}
