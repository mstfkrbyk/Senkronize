import type { Prisma } from '@prisma/client';

import { parseOrganizationMetadata } from '../organization/organization.types';

import type {
  MigrationDataType,
  MigrationFieldIssue,
  MigrationHistoryItem,
  MigrationSession,
  MigrationSessionStatus,
  MigrationSourceFormat,
} from './migration.types';

export const MIGRATION_IMPORT_HISTORY_KEY = 'migrationImportHistory';

/** Org metadata içinde saklanan kayıt (ham satır verisi yok). */
export interface MigrationImportHistoryRecord {
  id: string;
  createdAt: string;
  sourceFormat: MigrationSourceFormat;
  dataType: MigrationDataType;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  status: MigrationSessionStatus;
  errors?: MigrationFieldIssue[];
}

const MAX_HISTORY_ENTRIES = 50;
const MAX_STORED_ERRORS = 200;

export const MIGRATION_SOURCE_FORMAT_LABELS: Record<MigrationSourceFormat, string> = {
  generic_csv: 'CSV',
  generic_excel: 'Excel',
  generic_json: 'JSON',
  entegra_json: 'Entegra',
  woocommerce_xml: 'WooCommerce XML',
  woocommerce_csv: 'WooCommerce CSV',
  shopify_csv: 'Shopify',
  ticimax_csv: 'Ticimax',
  kolay_ik_json: 'Kolay IK',
};

function isMigrationSourceFormat(value: unknown): value is MigrationSourceFormat {
  return (
    typeof value === 'string' &&
    value in MIGRATION_SOURCE_FORMAT_LABELS
  );
}

function isMigrationDataType(value: unknown): value is MigrationDataType {
  return (
    value === 'products' ||
    value === 'orders' ||
    value === 'stock_movements' ||
    value === 'customers'
  );
}

function isMigrationSessionStatus(value: unknown): value is MigrationSessionStatus {
  return (
    value === 'uploaded' ||
    value === 'mapped' ||
    value === 'validated' ||
    value === 'queued' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'failed'
  );
}

function parseFieldIssues(raw: unknown): MigrationFieldIssue[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const issues: MigrationFieldIssue[] = [];
  for (const item of raw) {
    if (
      item !== null &&
      typeof item === 'object' &&
      'row' in item &&
      'field' in item &&
      'message' in item &&
      typeof (item as MigrationFieldIssue).row === 'number' &&
      typeof (item as MigrationFieldIssue).field === 'string' &&
      typeof (item as MigrationFieldIssue).message === 'string'
    ) {
      issues.push(item as MigrationFieldIssue);
    }
  }
  return issues.length > 0 ? issues : undefined;
}

function parseHistoryRecord(raw: unknown): MigrationImportHistoryRecord | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    typeof r.createdAt !== 'string' ||
    !isMigrationSourceFormat(r.sourceFormat) ||
    !isMigrationDataType(r.dataType) ||
    typeof r.fileName !== 'string' ||
    typeof r.total !== 'number' ||
    typeof r.success !== 'number' ||
    typeof r.failed !== 'number' ||
    !isMigrationSessionStatus(r.status)
  ) {
    return null;
  }
  return {
    id: r.id,
    createdAt: r.createdAt,
    sourceFormat: r.sourceFormat,
    dataType: r.dataType,
    fileName: r.fileName,
    total: r.total,
    success: r.success,
    failed: r.failed,
    status: r.status,
    errors: parseFieldIssues(r.errors),
  };
}

export function parseMigrationImportHistory(metadata: unknown): MigrationImportHistoryRecord[] {
  const meta = parseOrganizationMetadata(metadata);
  const raw = meta[MIGRATION_IMPORT_HISTORY_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  const records: MigrationImportHistoryRecord[] = [];
  for (const item of raw) {
    const parsed = parseHistoryRecord(item);
    if (parsed) {
      records.push(parsed);
    }
  }
  return records.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function toMigrationHistoryItem(
  record: MigrationImportHistoryRecord,
): MigrationHistoryItem {
  return {
    id: record.id,
    createdAt: record.createdAt,
    sourceFormat: record.sourceFormat,
    sourceLabel: MIGRATION_SOURCE_FORMAT_LABELS[record.sourceFormat],
    dataType: record.dataType,
    fileName: record.fileName,
    total: record.total,
    success: record.success,
    failed: record.failed,
    status: record.status,
    errors: record.errors,
  };
}

function collectSessionErrors(session: MigrationSession): MigrationFieldIssue[] {
  const merged = [...session.rowErrors];
  if (session.validationResult) {
    merged.push(...session.validationResult.errors);
  }
  return merged.slice(0, MAX_STORED_ERRORS);
}

export function buildHistoryRecordFromSession(
  session: MigrationSession,
  status: MigrationSessionStatus,
): MigrationImportHistoryRecord {
  const { progress } = session;
  const success = progress.imported + progress.updated + progress.skipped;
  const failed = progress.failed;
  const errors =
    status === 'failed' || failed > 0 ? collectSessionErrors(session) : undefined;

  return {
    id: session.id,
    createdAt: session.createdAt,
    sourceFormat: session.sourceFormat,
    dataType: session.dataType,
    fileName: session.fileName,
    total: progress.total || session.rawRows.length,
    success,
    failed,
    status,
    errors,
  };
}

export function appendMigrationImportHistory(
  metadata: unknown,
  record: MigrationImportHistoryRecord,
): Prisma.InputJsonValue {
  const meta = parseOrganizationMetadata(metadata);
  const existing = parseMigrationImportHistory(metadata).filter((r) => r.id !== record.id);
  const next = [record, ...existing].slice(0, MAX_HISTORY_ENTRIES);
  return {
    ...meta,
    [MIGRATION_IMPORT_HISTORY_KEY]: next,
  } as unknown as Prisma.InputJsonValue;
}
