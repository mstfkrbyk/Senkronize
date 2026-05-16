export interface SyncHealthStatus {
  organizationId: string;
  platform: string;
  lastSuccessAt: Date | null;
  errorCount: number;
  status: 'healthy' | 'warning' | 'error';
}
