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
}

export interface SyncResult {
  success: boolean;
  message: string;
  syncedAt: string;
}

export interface LocalErpTestResult {
  reachable: boolean;
  message: string;
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
      args: {
        apiUrl,
        token,
        localErpBaseUrl: localErpBaseUrl ?? null,
      },
    }),

  triggerSync: (apiUrl: string, token: string, platform: string): Promise<SyncResult> =>
    invoke<SyncResult>('trigger_sync', {
      args: { apiUrl, token, platform },
    }),

  testLocalErpConnection: (baseUrl: string): Promise<LocalErpTestResult> =>
    invoke<LocalErpTestResult>('test_local_erp_connection', {
      args: { baseUrl },
    }),
};
