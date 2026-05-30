export interface MarketplaceConnectionDto {
  id: string;
  platform: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  accountLabel: string | null;
  productMatchKey?: 'BARCODE' | 'SKU' | 'MANUAL' | null;
  pushStock?: boolean;
  pushPrice?: boolean;
}

export interface CreateConnectionPayload {
  platform: string;
  credentials: Record<string, string>;
}

export interface UpdateConnectionPayload {
  isActive?: boolean;
  credentials?: Record<string, string>;
  productMatchKey?: 'BARCODE' | 'SKU' | 'MANUAL' | null;
  pushStock?: boolean;
  pushPrice?: boolean;
}

export type TestConnectionPayload =
  | { platform: string; credentials: Record<string, string> }
  | { connectionId: string };
