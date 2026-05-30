import type { ActivityItem } from './admin.types';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from './admin-audit-log-labels.util';

export const ADMIN_PLATFORM_ACTIVITY_CSV_HEADERS = [
  'Tarih',
  'Eylem',
  'Kaynak',
  'Aktör org',
  'Aktör org ID',
  'Impersonation org',
  'Impersonation org ID',
] as const;

export const ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX = 500;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatActivityCsvDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  const h = String(value.getHours()).padStart(2, '0');
  const min = String(value.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function rowToCells(row: ActivityItem): string[] {
  const resource = formatAuditLogResourceDisplay(
    row.resourceType,
    row.resourceId,
  );
  const actorLabel = row.actorOrgName?.trim() || row.actorOrgId;
  const impLabel = row.impersonatedOrgId
    ? row.impersonatedOrgName?.trim() || row.impersonatedOrgId
    : '';

  return [
    formatActivityCsvDate(row.createdAt),
    formatAuditLogAction(row.action),
    resource,
    actorLabel,
    row.actorOrgId,
    impLabel,
    row.impersonatedOrgId ?? '',
  ];
}

export function buildAdminPlatformActivityCsv(rows: ActivityItem[]): string {
  const lines = [
    ADMIN_PLATFORM_ACTIVITY_CSV_HEADERS.join(','),
    ...rows.map((row) =>
      rowToCells(row).map((cell) => escapeCsvCell(cell)).join(','),
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}
