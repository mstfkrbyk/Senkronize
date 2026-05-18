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

/** OMS — ödemesi tamamlanmış kalemler (satır bazlı) */
export interface HepsiburadaMoney {
  amount?: number;
  currency?: string;
}

export interface HepsiburadaOmsLineItem {
  id?: string;
  orderNumber?: string;
  orderId?: string;
  status?: string;
  customerName?: string;
  merchantSKU?: string;
  sku?: string;
  productBarcode?: string;
  barcode?: string;
  quantity?: number;
  orderDate?: string;
  name?: string;
  unitPrice?: HepsiburadaMoney;
  totalPrice?: HepsiburadaMoney;
  cargoCompany?: string;
}

export interface HepsiburadaOmsPaged {
  items: HepsiburadaOmsLineItem[];
  totalCount: number;
}
