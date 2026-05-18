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

export interface SyncStatusResponse {
  intervalMinutes: number;
  lastSync: string | null;
  isRunning: boolean;
}

export interface UpdateCheckResponse {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
}

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

  startAutoSync: (intervalMinutes: number): Promise<void> =>
    invoke<void>('start_auto_sync', { interval_minutes: intervalMinutes }),

  stopAutoSync: (): Promise<void> => invoke<void>('stop_auto_sync'),

  getSyncStatus: (): Promise<SyncStatusResponse> => invoke<SyncStatusResponse>('get_sync_status'),

  recordLastSync: (atRfc3339?: string | null): Promise<void> =>
    invoke<void>('record_last_sync', { at_rfc3339: atRfc3339 ?? null }),

  checkForUpdates: (): Promise<UpdateCheckResponse> =>
    invoke<UpdateCheckResponse>('check_for_updates'),
};
