export interface PriceSimulationResult {
  currentPrice: number;
  simulatedPrice: number;
  marginImpact: {
    currentMarginPct: number | null;
    simulatedMarginPct: number | null;
  };
  estimatedBuyBoxProbability: number;
  estimatedRevenueDelta: number;
  referenceLowestPrice: number;
}

export interface BuyBoxReportTopLoser {
  listingId: string;
  title: string;
  barcode: string;
  platform: string;
  isWinner: boolean;
  currentPrice: number;
  lowestCompetitorPrice: number;
  buyBoxReferencePrice: number;
  priceGap: number;
  potentialRevenueLoss: number;
}

export interface BuyBoxReport {
  totalListings: number;
  buyBoxCount: number;
  winRate: number;
  potentialRevenueLoss: number;
  topLosers: BuyBoxReportTopLoser[];
}

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
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  daysOfWeek?: number[];
  hoursStart?: number | null;
  hoursEnd?: number | null;
  categoryFilter?: string | null;
  brandFilter?: string | null;
  skuPattern?: string | null;
}

export interface CompetitorPriceRow {
  id: string;
  organizationId: string;
  barcode: string;
  platform: string;
  competitorId: string;
  competitorName: string | null;
  price: string;
  currency: string;
  isBuyBox: boolean;
  capturedAt: string;
}

export interface PriceGapPlatformRow {
  platform: string;
  ourSalePrice: number | null;
  ourListPrice: number | null;
  buyBoxPrice: number | null;
  gapTry: number | null;
  gapPct: number | null;
  competitorCount: number;
}

export interface PriceGapAnalysis {
  barcode: string;
  platforms: PriceGapPlatformRow[];
}

export interface PriceTrendPoint {
  date: string;
  ourPrice: number | null;
  buyBoxPrice: number | null;
  avgCompetitorPrice: number | null;
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

export interface BuyBoxSnapshotSummary {
  barcode: string;
  platform: string;
  buyBoxPrice: string;
  ourPrice: string;
  isWinner: boolean;
  competitorCount: number;
  capturedAt: string;
}

export interface BuyBoxSummary {
  totalListings: number;
  winningBuyBox: number;
  winRate: number;
  activeRules: number;
  platforms: Array<{ platform: string; winRate: number; listings: number }>;
  snapshots?: BuyBoxSnapshotSummary[];
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

export interface ListingPriceHistoryItem {
  id: string;
  price: string;
  previousPrice: string | null;
  changePct: number | null;
  source: string;
  reason: string | null;
  appliedAt: string;
}

export interface PriceHistoryChartPoint {
  date: string;
  ourPrice: number | null;
  lowestCompetitor: number | null;
  avgCompetitor: number | null;
}

export interface ListingPriceHistoryResult {
  listingId: string;
  barcode: string;
  platform: string;
  title: string;
  currentPrice: string;
  items: ListingPriceHistoryItem[];
  chart: PriceHistoryChartPoint[];
}

export interface CompetitorMatrixPlatformCell {
  platform: string;
  listingId: string;
  ourPrice: number;
  lowestCompetitor: number | null;
  isCheapest: boolean;
}

export interface CompetitorMatrixRow {
  barcode: string;
  title: string;
  platforms: CompetitorMatrixPlatformCell[];
  globalLowest: number | null;
}

export interface PriceAlertRow {
  id: string;
  listingId: string;
  barcode: string;
  platform: string;
  title: string;
  thresholdPrice: string;
  currentPrice: string;
  isTriggered: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifySms: boolean;
  createdAt: string;
}

export interface TriggeredPriceAlert {
  alertId: string;
  listingId: string;
  barcode: string;
  platform: string;
  title: string;
  currentPrice: string;
  thresholdPrice: string;
  gapTry: number;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifySms: boolean;
}

export interface PriceAlertsResponse {
  triggered: TriggeredPriceAlert[];
  all: PriceAlertRow[];
}
