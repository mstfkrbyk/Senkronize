export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ProductListItem {
  id: string;
  organizationId: string;
  barcode: string;
  sku: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  costPrice: unknown;
  tags: string[];
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantDto {
  id: string;
  organizationId: string;
  productId: string;
  sku: string;
  barcode: string | null;
  title: string;
  attributes: unknown;
  price: unknown;
  costPrice: unknown;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetailListing {
  id: string;
  platform: string;
  title: string;
  salePrice: unknown;
  listPrice: unknown;
  quantity: number;
  approved: boolean;
  lastSyncAt: string | null;
}

export interface ProductDetailStock {
  id: string;
  barcode: string;
  platform: string | null;
  quantity: number;
  reservedQty: number;
  updatedAt: string;
}

export interface ProductDetailPayload {
  product: {
    id: string;
    organizationId: string;
    barcode: string;
    sku: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    costPrice: unknown;
    tags: string[];
    imageUrls: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  variants: ProductVariantDto[];
  listings: ProductDetailListing[];
  stockMovements: ProductDetailStock[];
}
