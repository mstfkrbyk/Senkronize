import type { ErpType, Marketplace } from './enums';

/**
 * Senkronize çekirdeğinde kullanılan ürün DTO’su (adaptörlerle paylaşılır).
 * Prisma `Product` modeli ile alanlar uyumludur.
 */
export interface Product {
  id: string;
  organizationId: string;
  name: string;
  sku?: string | null;
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
  productId: string;
  marketplace: Marketplace;
  externalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
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

// Bölüm 16 — Pazaryeri adaptörü arayüzü
export interface IMarketplaceAdapter {
  platform: Marketplace;
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  pushProducts(products: Product[], orgId: string): Promise<SyncResult>;
  pushStock(listings: Listing[], orgId: string): Promise<SyncResult>;
  pushPrices(listings: Listing[], orgId: string): Promise<SyncResult>;
  pullOrders(orgId: string, since?: Date): Promise<Order[]>;
  pullStock(orgId: string): Promise<StockUpdate[]>;
  handleWebhook(payload: unknown, secret: string): Promise<WebhookEvent>;
}

// Bölüm 16 — ERP adaptörü arayüzü
export interface IErpAdapter {
  type: ErpType;
  mode: 'cloud' | 'local-agent';
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  pullProducts(orgId: string): Promise<Product[]>;
  pullStock(orgId: string): Promise<StockUpdate[]>;
  pushOrders(orders: Order[], orgId: string): Promise<void>;
  pushInvoice?(order: Order, orgId: string): Promise<void>;
}
