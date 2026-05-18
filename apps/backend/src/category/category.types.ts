import type { Marketplace, PlatformCategoryMapping, Product } from '@prisma/client';

export interface CategoryTreeNode {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children: CategoryTreeNode[];
}

export interface CategoryProductSummary {
  id: string;
  barcode: string;
  name: string;
  sku: string | null;
  isActive: boolean;
}

export interface CategoryDetailPayload {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  platformMappings: Pick<
    PlatformCategoryMapping,
    'id' | 'platform' | 'platformCategoryId' | 'platformCategoryName'
  >[];
  products: CategoryProductSummary[];
}

export interface PlatformMappingRow {
  id: string;
  internalCategoryId: string;
  platform: Marketplace;
  platformCategoryId: string;
  platformCategoryName: string;
}

export interface CategoryListRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSearchHit {
  id: string;
  barcode: string;
  name: string;
  sku: string | null;
}
