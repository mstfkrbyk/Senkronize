export interface EtsyReceipt {
  receipt_id?: number;
  status?: string;
  name?: string;
  buyer_email?: string;
  creation_tsz?: number;
  Grandtotal?: { amount?: number; divisor?: number; currency_code?: string };
  transactions?: EtsyTransaction[];
}

export interface EtsyTransaction {
  listing_id?: number;
  title?: string;
  quantity?: number;
  price?: { amount?: number; divisor?: number };
  sku?: string[];
}

export interface EtsyReceiptsResponse {
  count?: number;
  results?: EtsyReceipt[];
}

export interface EtsyListingImage {
  url_fullxfull?: string;
}

export interface EtsyListing {
  listing_id?: number;
  title?: string;
  sku?: string[];
  quantity?: number;
  price?: { amount?: number; divisor?: number };
  Images?: EtsyListingImage[];
}

export interface EtsyListingsResponse {
  count?: number;
  results?: EtsyListing[];
}
