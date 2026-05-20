import type { Campaign, CampaignStatus, CampaignType, Marketplace } from '@prisma/client';

export type CampaignDiscountType = 'PERCENTAGE' | 'FIXED' | 'PRICE_SET';

export interface CampaignPriceSnapshot {
  salePrice: string;
  listPrice: string;
}

export type CampaignOriginalPrices = Record<string, CampaignPriceSnapshot>;

export interface CampaignFilter {
  status?: CampaignStatus;
}

export interface CampaignListItem extends Campaign {
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

export interface CampaignDetail extends CampaignListItem {
  affectedProducts: Array<{
    id: string;
    productId: string | null;
    barcode: string;
    title: string;
    platform: Marketplace;
    currentPrice: string;
    originalPrice: string | null;
    discountedPrice: string;
  }>;
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  FLASH_SALE: 'Flaş indirim',
  SEASONAL: 'Sezonsal',
  CLEARANCE: 'Stok eritme',
  BUNDLE: 'Paket indirim',
  LOYALTY: 'Sadakat',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  ENDED: 'Bitti',
};
