export interface SyncHealthStatus {
  organizationId: string;
  connectionId: string;
  platform: string;
  lastSuccessAt: Date | null;
  errorCount: number;
  status: 'healthy' | 'warning' | 'error';
}
