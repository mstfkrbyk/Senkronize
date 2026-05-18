export type PricingStrategy =
  | 'MATCH_BUYBOX'
  | 'BEAT_BUYBOX'
  | 'FIXED_MARGIN'
  | 'DYNAMIC'
  | 'AGGRESSIVE_BUYBOX'
  | 'PROFIT_FOCUSED'
  | 'TIME_BASED'
  | 'STOCK_BASED';

export interface PricingRule {
  id: string;
  name: string;
  platform: string;
  strategy: PricingStrategy;
  minMarginPct: string;
  maxDiscountPct: string;
  targetPosition: number;
  isActive: boolean;
  applyToAll: boolean;
  barcodes: string[];
  createdAt: string;
  costPrice?: number | null;
  minMarginPercent?: number | null;
  stepAmount?: number | null;
  nightDiscountPercent?: number | null;
  peakPremiumPercent?: number | null;
  lowStockThreshold?: number | null;
  highStockThreshold?: number | null;
  maxPrice?: number | null;
}

export interface BuyBoxWinRateStats {
  totalChecks: number;
  winCount: number;
  winRate: number;
  avgPriceWhenWinning: number;
  avgPriceWhenLosing: number;
}

export interface BuyBoxListingAnalysis {
  currentPrice: number;
  competitorPrices: number[];
  hasBuyBox: boolean;
  buyBoxPrice: number | null;
  priceGap: number;
  recommendation: string;
  suggestedPrice: number;
}

export interface BuyBoxSummary {
  totalListings: number;
  winningBuyBox: number;
  winRate: number;
  activeRules: number;
  platforms: Array<{ platform: string; winRate: number; listings: number }>;
}

export interface PriceHistoryEntry {
  id: string;
  barcode: string;
  platform: string;
  oldPrice: string;
  newPrice: string;
  reason: string | null;
  appliedAt: string;
}
