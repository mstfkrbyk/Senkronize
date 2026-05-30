/** BizimHesap B2B API — /products yanıt formatı */
export interface BizimHesapProductRow {
  Id?: string;
  id?: string;
  productId?: string | number;
  ProductId?: string | number;
  Code?: string;
  code?: string;
  productCode?: string;
  Name?: string;
  name?: string;
  productName?: string;
  ProductName?: string;
  Title?: string;
  title?: string;
  StockName?: string;
  stockName?: string;
  StokAdi?: string;
  stokAdi?: string;
  UrunAdi?: string;
  urunAdi?: string;
  ProductTitle?: string;
  productTitle?: string;
  Description?: string;
  description?: string;
  Aciklama?: string;
  aciklama?: string;
  Barcode?: string;
  barcode?: string;
  StockQuantity?: number;
  stock_quantity?: number;
  stockQuantity?: number;
  quantity?: number;
  PurchasePrice?: number;
  purchase_price?: number;
  purchasePrice?: number;
  SalePrice?: number;
  sale_price?: number;
  salePrice?: number;
  IsEcommerce?: boolean | number | string;
  isEcommerce?: boolean | number | string;
  is_ecommerce?: boolean | number | string;
  CategoryId?: string | number;
  categoryId?: string | number;
  category_id?: string | number;
  CategoryName?: string;
  categoryName?: string;
  category_name?: string;
  Category?: string;
  category?: string;
  KategoriAdi?: string;
  kategoriAdi?: string;
}

export interface BizimHesapProductsResponse {
  data?: BizimHesapProductRow[] | Record<string, BizimHesapProductRow>;
  Data?: BizimHesapProductRow[] | Record<string, BizimHesapProductRow>;
  products?: BizimHesapProductRow[];
  Products?: BizimHesapProductRow[];
  items?: BizimHesapProductRow[];
  Items?: BizimHesapProductRow[];
  meta?: { total?: number; page?: number; per_page?: number };
  total?: number;
}

/** /addinvoice yanıt formatı */
export interface BizimHesapAddInvoiceResponse {
  error: string;
  guid: string;
  url: string;
}

/** /warehouses yanıt satırı */
export interface BizimHesapWarehouseRow {
  Id: string;
  Name: string;
}
