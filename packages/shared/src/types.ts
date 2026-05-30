import type { Marketplace } from './enums';

/**
 * Senkronize çekirdeğinde kullanılan ürün DTO’su (adaptörlerle paylaşılır).
 * Prisma `Product` modeli ile alanlar uyumludur.
 */
export interface Product {
  id: string;
  organizationId: string;
  barcode: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  imageUrls: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Pazaryeri listeleme kaydı (adaptör senkronu).
 */
export interface Listing {
  id: string;
  organizationId: string;
  productId?: string | null;
  platform: Marketplace;
  platformProductId: string;
  barcode: string;
  title: string;
  salePrice: number;
  listPrice: number;
  quantity: number;
  approved: boolean;
  imageUrls: string[];
  lastSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Sipariş DTO’su (adaptör pull/push).
 */
export interface Order {
  id: string;
  organizationId: string;
  externalId?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stok güncelleme satırı (pazaryeri veya ERP pull sonucu).
 */
export interface StockUpdate {
  listingId: string;
  quantity: number;
  sku?: string;
}

/**
 * Toplu senkron işlemi sonucu.
 */
export interface SyncResult {
  success: boolean;
  syncedCount?: number;
  errors?: string[];
}

/**
 * Pazaryeri webhook işleme çıktısı.
 */
export interface WebhookEvent {
  /** Örn. order.created, listing.updated */
  type: string;
  payload: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceOrder {
  platformOrderId: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingAddress?: string;
  items: Array<{
    sku: string;
    barcode: string;
    quantity: number;
    unitPrice: number;
    platformItemId: string;
    productName?: string;
  }>;
  totalAmount: number;
  currency: string;
  createdAt: string;
  cargoTrackingNumber?: string;
  cargoProvider?: string;
}

/** Pazaryeri iade satırı (adaptör pull). */
export interface MarketplaceReturnItem {
  barcode: string;
  quantity: number;
  reason?: string;
  condition?: string;
}

/** Pazaryeri iade kaydı (adaptör pull). */
export interface MarketplaceReturn {
  platformReturnId?: string | null;
  platformOrderId: string;
  status: string;
  reason?: string;
  refundAmount?: number;
  refundStatus?: string;
  requestedAt: string;
  resolvedAt?: string;
  items: MarketplaceReturnItem[];
}

export interface MarketplaceListing {
  platformProductId: string;
  barcode: string;
  /** Platform stok kodu (Ticimax StokKodu vb.) — SKU eşleştirmede barkoddan farklıysa kullanılır */
  platformSku?: string;
  title: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
  approved: boolean;
  images: string[];
}

export interface StockUpdatePayload {
  barcode: string;
  quantity: number;
  /** Ticimax vb. platformlarda varyasyon/ürün kartı kimliği */
  platformProductId?: string;
}

export interface PriceUpdatePayload {
  barcode: string;
  salePrice: number;
  listPrice: number;
}

export interface IMarketplaceAdapter {
  platform: string;
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]>;
  getListings(
    credentials: Record<string, string>,
    page?: number,
  ): Promise<PaginatedResult<MarketplaceListing>>;
  updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void>;
  updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void>;
  /** İade listesi — destekleyen platformlar için. */
  getReturns?(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceReturn[]>;
  approveReturn?(
    credentials: Record<string, string>,
    platformReturnId: string,
  ): Promise<void>;
  rejectReturn?(
    credentials: Record<string, string>,
    platformReturnId: string,
    reason: string,
  ): Promise<void>;
  cancelOrder?(
    credentials: Record<string, string>,
    platformOrderId: string,
    reason?: string,
  ): Promise<void>;
}

/** E-ticaret altyapısı adaptörü — `IMarketplaceAdapter` ile aynı sözleşme (örn. Shopiverse). */
export type IEcommerceAdapter = IMarketplaceAdapter;

export interface ErpInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  /** ERP stok kartı kodu (Logo/Mikro vb.) */
  sku?: string;
}

export interface ErpInvoice {
  erpInvoiceId: string;
  /** Pazaryeri / platform sipariş kimliği */
  orderRef: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  issuedAt: string;
  lines: ErpInvoiceLine[];
  /** ERP cari unvanı */
  customerName?: string;
}

export interface ErpProduct {
  erpProductId: string;
  barcode: string;
  /** Stok / ürün kodu (SKU); yoksa barkod ile aynı olabilir */
  sku?: string;
  name: string;
  stockQuantity: number;
  purchasePrice?: number;
}

/** ERP ürün içe aktarma kapsamı */
export type ErpProductImportMode = 'ECOMMERCE_ONLY' | 'CATEGORY' | 'ALL';

export interface ErpProductImportOptions {
  mode: ErpProductImportMode;
  /** CATEGORY modunda ERP kategori ID veya adları */
  categoryIds?: string[];
}

/** ERP bağlantı testi sonucu */
export interface ERPConnectionResult {
  success: boolean;
  companyName?: string;
  version?: string;
  productCount?: number;
  /** Bağlantı testi süresi (ms) */
  responseTimeMs?: number;
  /** Başarısız testte kullanıcıya gösterilecek özet mesaj */
  message?: string;
}

/** ERP adaptörü — bulut API (BizimHesap vb.) */
export interface IErpAdapter {
  erpType: string;
  testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult>;
  getProducts(credentials: Record<string, string>): Promise<ErpProduct[]>;
  createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice>;
  getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]>;
}
