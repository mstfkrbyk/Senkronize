export type CampaignType =
  | 'FLASH_SALE'
  | 'SEASONAL'
  | 'CLEARANCE'
  | 'BUNDLE'
  | 'LOYALTY';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ENDED';

export type CampaignDiscountType = 'PERCENTAGE' | 'FIXED' | 'PRICE_SET';

export type CampaignTargetMode = 'ALL' | 'CATEGORIES' | 'PRODUCTS';

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate: string | null;
  platforms: string[];
  productIds: string[];
  categoryIds: string[];
  discountType: CampaignDiscountType;
  discountValue: string;
  minPrice: string | null;
  minOrderAmount: string | null;
  maxUses: number | null;
  usageCount: number;
  impressions: number;
  createdAt: string;
  updatedAt: string;
  affectedProductCount: number;
}

export interface CampaignImpactProduct {
  id: string;
  name: string;
  barcode: string;
  currentPrice: string;
  discountedPrice: string;
  marginPct: number | null;
}

export interface CampaignImpact {
  affectedProductCount: number;
  estimatedRevenueLoss: string;
  avgDiscountPct: number;
  productsAtRisk: CampaignImpactProduct[];
}

export interface CampaignDetail extends Campaign {
  affectedProducts: Array<{
    id: string;
    productId: string | null;
    barcode: string;
    title: string;
    platform: string;
    currentPrice: string;
    originalPrice: string | null;
    discountedPrice: string;
  }>;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  startDate: string;
  endDate?: string;
  platforms: string[];
  productIds?: string[];
  categoryIds?: string[];
  discountType: CampaignDiscountType;
  discountValue: number;
  minPrice?: number;
  minOrderAmount?: number;
  maxUses?: number;
}
