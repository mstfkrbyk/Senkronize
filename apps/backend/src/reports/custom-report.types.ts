import type { ReportType } from '@prisma/client';

export type ReportFilterOperator = 'eq' | 'gt' | 'lt' | 'contains' | 'in';

export interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value: unknown;
}

/** Panel ve API arasında JSON uyumlu tarih aralığı */
export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportConfig {
  reportType: ReportType;
  columns: string[];
  /** Kolon başlığı özelleştirmesi (alan → görünen ad) */
  columnLabels?: Record<string, string>;
  /** Kolon gizleme (export’ta da uygulanır) */
  columnHidden?: Record<string, boolean>;
  filters: ReportFilter[];
  groupBy?: string;
  orderBy?: string;
  dateRange?: ReportDateRange;
  platforms?: string[];
  limit?: number;
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SavedReportSchedule {
  cron: string;
  emails: string[];
  format?: 'csv' | 'json';
  /** Günlük: her gece; haftalık: Pazartesi 00:00 (sunucu saati) */
  frequency?: 'daily' | 'weekly';
}

export interface SavedReportListItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  reportType: ReportType;
  config: ReportConfig;
  schedule: SavedReportSchedule | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  creatorName: string;
  creatorEmail: string;
}
