import { format } from 'date-fns';
import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import {
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import { formatAdminOrgDate } from '@/lib/admin-org-list-normalize';
import { api } from '@/lib/api';
import type { AdminActivityItem } from '@/types/admin';

type Translate = TFunction;

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as Translate;
}

export function getAdminPlatformAuditCsvHeaders(t?: Translate): string[] {
  const tr = resolveT(t);
  return [
    tr('admin.pages.auditLogs.csv.date'),
    tr('admin.pages.auditLogs.csv.action'),
    tr('admin.pages.auditLogs.csv.resource'),
    tr('admin.pages.auditLogs.csv.actorOrg'),
    tr('admin.pages.auditLogs.csv.actorOrgId'),
    tr('admin.pages.auditLogs.csv.impersonationOrg'),
    tr('admin.pages.auditLogs.csv.impersonationOrgId'),
  ];
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function rowToCells(row: AdminActivityItem): string[] {
  const resource = formatAuditLogResourceDisplay(
    row.resourceType,
    row.resourceId,
  );
  const actorLabel = row.actorOrgName?.trim() || row.actorOrgId;
  const impLabel = row.impersonatedOrgId
    ? row.impersonatedOrgName?.trim() || row.impersonatedOrgId
    : '';

  return [
    formatAdminOrgDate(row.createdAt, 'yyyy-MM-dd HH:mm'),
    formatAuditLogAction(row.action),
    resource,
    actorLabel,
    row.actorOrgId,
    impLabel,
    row.impersonatedOrgId ?? '',
  ];
}

export function adminPlatformAuditToCsv(
  rows: AdminActivityItem[],
  t?: Translate,
): string {
  const tr = resolveT(t);
  const headers = getAdminPlatformAuditCsvHeaders(tr);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      rowToCells(row).map((cell) => escapeCsvCell(cell)).join(','),
    ),
  ];
  return lines.join('\n');
}

function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function defaultAdminPlatformAuditCsvFilename(t?: Translate): string {
  const tr = resolveT(t);
  const date = format(new Date(), 'yyyy-MM-dd');
  return tr('admin.pages.auditLogs.csv.filename', { date });
}

/** Sunucu CSV dışa aktarma (`GET /admin/activity/export?format=csv`). */
export async function downloadAdminPlatformAuditCsvFromServer(
  filename?: string,
  t?: Translate,
): Promise<void> {
  const response = await api.get('/admin/activity/export', {
    params: { format: 'csv' },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  triggerCsvDownload(
    blob,
    filename ?? defaultAdminPlatformAuditCsvFilename(t),
  );
}

export function downloadAdminPlatformAuditCsv(
  rows: AdminActivityItem[],
  filename?: string,
  t?: Translate,
): void {
  const csv = '\uFEFF' + adminPlatformAuditToCsv(rows, t);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerCsvDownload(blob, filename ?? defaultAdminPlatformAuditCsvFilename(t));
}
