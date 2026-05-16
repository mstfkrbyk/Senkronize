export interface MarketplaceConnectionDto {
  id: string;
  platform: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncErrorCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  accountLabel: string | null;
}

export interface CreateConnectionPayload {
  platform: string;
  credentials: Record<string, string>;
}

export interface UpdateConnectionPayload {
  isActive?: boolean;
  credentials?: Record<string, string>;
}

export type TestConnectionPayload =
  | { platform: string; credentials: Record<string, string> }
  | { connectionId: string };
