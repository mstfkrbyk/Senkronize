export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogsPageResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}
