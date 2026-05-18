/** Mikro ERP web servis — yanıt şekilleri kuruluma göre değişebilir */

export interface MikroLoginResponse {
  accessToken: string;
}

export interface MikroProduct {
  code?: string;
  name?: string;
  stockQty?: number;
  purchasePrice?: number;
  barcode?: string;
}

export interface MikroProductsResponse {
  products?: MikroProduct[];
  items?: MikroProduct[];
}

export interface MikroInvoiceCreateResponse {
  invoiceNumber?: string;
  number?: string;
  id?: string;
}
