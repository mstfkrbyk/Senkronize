export type ReportType =
  | 'ORDERS'
  | 'PRODUCTS'
  | 'LISTINGS'
  | 'STOCK'
  | 'PROFIT'
  | 'PLATFORM_COMPARISON'
  | 'CUSTOM';

export type ReportFilterOperator = 'eq' | 'gt' | 'lt' | 'contains' | 'in';

export interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value: unknown;
}

export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportConfig {
  reportType: ReportType;
  columns: string[];
  columnLabels?: Record<string, string>;
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
  frequency?: 'daily' | 'weekly' | 'monthly';
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

export interface ScheduledCustomReportItem {
  id: string;
  name: string;
  schedule: SavedReportSchedule;
  lastRunAt: string | null;
  createdAt: string;
}
