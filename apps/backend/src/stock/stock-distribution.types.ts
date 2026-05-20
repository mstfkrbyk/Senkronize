export type StockDistributionStrategy = 'EQUAL' | 'PROPORTIONAL' | 'PRIORITY';

export interface DistributionResult {
  distribution: Record<string, number>;
  pushedAt: string;
  jobIds: string[];
}

export interface DistributionPreview {
  barcode: string;
  totalStock: number;
  byPlatform: Record<string, number>;
}
