import { invoke } from '@tauri-apps/api/core';

export interface TokenPayload {
  token: string;
  orgName: string;
  orgId: string;
}

export interface HealthStatus {
  cloudConnected: boolean;
  localErpConnected: boolean;
  lastSyncAt: string | null;
  version: string;
  ordersLast24h?: number | null;
  listingsSyncedLast24h?: number | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  syncedAt: string;
  /** Yoksa `success` alanından türetilir */
  level?: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN';
}

export interface LocalErpTestResult {
  reachable: boolean;
  message: string;
}

export interface ErpTestResult {
  success: boolean;
  message: string;
  productCount: number | null;
  erpVersion: string | null;
  durationMs: number;
}

export interface ErpConfigPayload {
  erpType: string;
  baseUrl: string;
  username: string;
  password: string;
  extra: string | null;
}

export interface ErpToCloudSyncResult {
  success: boolean;
  syncedCount: number;
  errorCount: number;
  message: string;
}

export interface ErpSyncEngineResult {
  productsSynced: number;
  ordersPushed: number;
  errors: string[];
  durationMs: number;
  syncedAt: string;
}

export interface SyncStatusResponse {
  intervalMinutes: number;
  lastSync: string | null;
  isRunning: boolean;
  isSyncing: boolean;
  pendingItemCount: number;
  nextSyncAt: string | null;
}

export interface ErpDeltaSyncResult {
  productsSynced: number;
  ordersPushed: number;
  errors: string[];
  durationMs: number;
  syncedAt: string;
  delta: boolean;
}

export interface ErpSyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  pendingItemCount: number;
}

export interface UpdateCheckResponse {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
}

export type TrayIndicatorMode = 'idle' | 'syncing' | 'error';

export const tauriApi = {
  saveToken: (payload: TokenPayload): Promise<void> =>
    invoke<void>('save_token', { payload }),

  loadToken: (): Promise<TokenPayload | null> => invoke<TokenPayload | null>('load_token'),

  clearToken: (): Promise<void> => invoke<void>('clear_token'),

  checkHealth: (
    apiUrl: string,
    token: string,
    localErpBaseUrl?: string | null,
  ): Promise<HealthStatus> =>
    invoke<HealthStatus>('check_health', {
      apiUrl,
      token,
      localErpBaseUrl: localErpBaseUrl ?? null,
    }),

  triggerSync: (apiUrl: string, token: string, platform: string): Promise<SyncResult> =>
    invoke<SyncResult>('trigger_sync', { apiUrl, token, platform }),

  testLocalErpConnection: (baseUrl: string): Promise<LocalErpTestResult> =>
    invoke<LocalErpTestResult>('test_local_erp_connection', { baseUrl }),

  testErpConnection: (args: {
    erpType: string;
    baseUrl: string;
    username: string;
    password: string;
    extra: string | null;
  }): Promise<ErpTestResult> => invoke<ErpTestResult>('test_erp_connection', args),

  syncErpToCloud: (args: {
    erpConfig: ErpConfigPayload;
    cloudApiUrl: string;
    cloudApiKey: string;
  }): Promise<ErpToCloudSyncResult> => invoke<ErpToCloudSyncResult>('sync_erp_to_cloud', args),

  syncErpProducts: (args: {
    erpType: string;
    credentials: Record<string, unknown>;
    cloudApiUrl: string;
    apiKey: string;
  }): Promise<ErpSyncEngineResult> =>
    invoke<ErpSyncEngineResult>('sync_erp_products', {
      erp_type: args.erpType,
      credentials: args.credentials,
      cloud_api_url: args.cloudApiUrl,
      api_key: args.apiKey,
    }),

  syncErpOrders: (args: {
    erpType: string;
    credentials: Record<string, unknown>;
    cloudApiUrl: string;
    apiKey: string;
  }): Promise<ErpSyncEngineResult> =>
    invoke<ErpSyncEngineResult>('sync_erp_orders', {
      erp_type: args.erpType,
      credentials: args.credentials,
      cloud_api_url: args.cloudApiUrl,
      api_key: args.apiKey,
    }),

  startAutoSync: (intervalMinutes: number): Promise<void> =>
    invoke<void>('start_auto_sync', { interval_minutes: intervalMinutes }),

  stopAutoSync: (): Promise<void> => invoke<void>('stop_auto_sync'),

  getSyncStatus: (): Promise<SyncStatusResponse> => invoke<SyncStatusResponse>('get_sync_status'),

  getErpSyncStatus: (): Promise<ErpSyncStatus> => invoke<ErpSyncStatus>('get_erp_sync_status'),

  syncDelta: (args: {
    erpType: string;
    credentials: Record<string, unknown>;
    cloudApiUrl: string;
    apiKey: string;
    since?: string | null;
  }): Promise<ErpDeltaSyncResult> =>
    invoke<ErpDeltaSyncResult>('sync_delta', {
      erp_type: args.erpType,
      credentials: args.credentials,
      cloud_api_url: args.cloudApiUrl,
      api_key: args.apiKey,
      since: args.since ?? null,
    }),

  recordLastSync: (atRfc3339?: string | null): Promise<void> =>
    invoke<void>('record_last_sync', { at_rfc3339: atRfc3339 ?? null }),

  checkForUpdates: (cloudBaseUrl?: string | null): Promise<UpdateCheckResponse> =>
    invoke<UpdateCheckResponse>('check_for_updates', { cloud_base_url: cloudBaseUrl ?? null }),

  setTrayIndicator: (mode: TrayIndicatorMode): Promise<void> =>
    invoke<void>('set_tray_indicator', { mode }),

  setTrayErpName: (name: string): Promise<void> =>
    invoke<void>('set_tray_erp_name', { name }),

  setTrayOrgContext: (line: string): Promise<void> =>
    invoke<void>('set_tray_org_context', { line }),
};
