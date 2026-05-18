export interface OzonPosting {
  posting_number?: string;
  status?: string;
  in_process_at?: string;
  financial_data?: {
    posting_services?: { products_currency_code?: string };
    products?: Array<{ price?: string }>;
  };
  products?: Array<{
    sku?: number;
    offer_id?: string;
    name?: string;
    quantity?: number;
    price?: string;
  }>;
}

export interface OzonPostingsListResult {
  postings?: OzonPosting[];
  has_next?: boolean;
}

export interface OzonPostingsListResponse {
  result?: OzonPostingsListResult;
}

export interface OzonProductListItem {
  product_id?: number;
  offer_id?: string;
  name?: string;
  currency_code?: string;
  price?: string;
  stocks?: { present?: number };
}

export interface OzonProductListResponse {
  result?: {
    items?: OzonProductListItem[];
    total?: number;
    last_id?: string;
  };
}
