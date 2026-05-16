export interface SyncStatusItem {
  organizationId: string;
  platform: string;
  lastSuccessAt: string | null;
  errorCount: number;
  status: 'healthy' | 'warning' | 'error';
}
