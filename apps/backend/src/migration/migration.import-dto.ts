/** Ürün içe aktarma — normalize edilmiş satır */
export interface ProductImportDto {
  name: string;
  sku?: string;
  barcode: string;
  price: number;
  listPrice?: number;
  stock?: number;
  category?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
}

export interface OrderImportItemDto {
  sku: string;
  barcode: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

/** Sipariş içe aktarma */
export interface OrderImportDto {
  platformOrderId: string;
  platform: string;
  orderDate: string;
  status?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  totalAmount: number;
  currency?: string;
  cargoTrackingNumber?: string;
  cargoProvider?: string;
  items: OrderImportItemDto[];
}

/** Müşteri içe aktarma */
export interface CustomerImportDto {
  name: string;
  email?: string;
  phone?: string;
  platform?: string;
  externalId?: string;
}

/** Stok hareketi içe aktarma */
export interface StockMovementImportDto {
  barcode: string;
  movementType: 'in' | 'out';
  quantity: number;
  date?: string;
  note?: string;
  platform?: string;
}
