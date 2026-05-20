import type { SyncIntervalOption, SyncSettings } from '@/lib/sync-settings-store';

export type CloudErpSyncFrequency =
  | 'REALTIME'
  | 'EVERY_15_MIN'
  | 'HOURLY'
  | 'EVERY_4_HOURS'
  | 'DAILY'
  | 'MANUAL';

export interface CloudErpSyncSettings {
  syncFrequency: CloudErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
}

export interface CloudErpConnection {
  id: string;
  erpType: string;
  isActive: boolean;
}

function frequencyToInterval(frequency: CloudErpSyncFrequency): SyncIntervalOption {
  switch (frequency) {
    case 'REALTIME':
      return 5;
    case 'EVERY_15_MIN':
      return 15;
    case 'HOURLY':
      return 60;
    case 'EVERY_4_HOURS':
      return 60;
    case 'DAILY':
      return 60;
    case 'MANUAL':
      return null;
    default:
      return 15;
  }
}

export function mapCloudSettingsToLocal(cloud: CloudErpSyncSettings): SyncSettings {
  return {
    intervalMinutes: frequencyToInterval(cloud.syncFrequency),
    syncStock: cloud.syncStock,
    syncOrder: cloud.syncInvoices,
    syncProduct: cloud.syncProducts,
    syncPrice: false,
    deltaOnly: false,
    autoSyncOnStartup: false,
    notifyOnComplete: true,
    notifyOnError: true,
    dailySummaryHour: null,
  };
}

export async function fetchErpConnections(
  apiUrl: string,
  token: string,
): Promise<CloudErpConnection[]> {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/erp-connections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('ERP bağlantıları alınamadı');
  }
  return (await res.json()) as CloudErpConnection[];
}

export async function fetchErpSyncSettings(
  apiUrl: string,
  token: string,
  connectionId: string,
): Promise<CloudErpSyncSettings> {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/erp-connections/${connectionId}/sync-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('ERP senkron ayarları alınamadı');
  }
  const body = (await res.json()) as { data: CloudErpSyncSettings };
  return body.data;
}

/** Bulut panelindeki ayarları yerel zamanlayıcıya uygular */
export async function loadCloudErpSyncSettings(
  apiUrl: string,
  token: string,
  erpType: string,
): Promise<SyncSettings | null> {
  const connections = await fetchErpConnections(apiUrl, token);
  const match = connections.find((c) => c.erpType === erpType && c.isActive);
  if (!match) {
    return null;
  }
  const cloud = await fetchErpSyncSettings(apiUrl, token, match.id);
  return mapCloudSettingsToLocal(cloud);
}
