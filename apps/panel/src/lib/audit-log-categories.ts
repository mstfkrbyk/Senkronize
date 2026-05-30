import {
  isAccountingOnlyOrg,
  isBundleOrg,
  isIntegrationOnlyOrg,
} from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';
import type { AuditLogEntry } from '@/types/audit-log';

export type AuditLogProductCategory = 'all' | 'integration' | 'accounting' | 'system';

const INTEGRATION_RESOURCES = new Set([
  'MarketplaceConnection',
  'EcommerceConnection',
  'CargoConnection',
]);

const ACCOUNTING_RESOURCES = new Set(['ErpConnection']);

const INTEGRATION_ACTION_PREFIXES = ['sync_'] as const;

const ACCOUNTING_ACTION_PREFIXES = ['erp.'] as const;

const SYSTEM_ACTION_PREFIXES = [
  'auth.',
  'users.',
  'user.',
  'email.',
  'partner.',
  'subscription.',
  'admin.',
] as const;

/** Backend `buildSyncAuditWhere` ile uyumlu kuyruk iş adları */
const SYNC_QUEUE_JOB_NAMES = new Set([
  'pull-orders',
  'pull-listings',
  'pull-returns',
  'push-stock',
  'push-price',
  'push-return-action',
  'push-order-cancel',
]);

function actionStartsWithAny(action: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => action.startsWith(p));
}

function syncQueueJobFailed(entry: Pick<AuditLogEntry, 'action' | 'metadata'>): boolean {
  if (entry.action !== 'queue.job_failed') {
    return false;
  }
  const jobName = entry.metadata.jobName;
  return typeof jobName === 'string' && SYNC_QUEUE_JOB_NAMES.has(jobName);
}

/** Pazaryeri / kanal entegrasyonu denetim kaydı */
export function isIntegrationAuditLog(
  entry: Pick<AuditLogEntry, 'action' | 'resource' | 'metadata'>,
): boolean {
  if (INTEGRATION_RESOURCES.has(entry.resource)) {
    return true;
  }
  if (actionStartsWithAny(entry.action, INTEGRATION_ACTION_PREFIXES)) {
    return true;
  }
  return syncQueueJobFailed(entry);
}

export function isAccountingAuditLog(
  entry: Pick<AuditLogEntry, 'action' | 'resource'>,
): boolean {
  if (ACCOUNTING_RESOURCES.has(entry.resource)) {
    return true;
  }
  return actionStartsWithAny(entry.action, ACCOUNTING_ACTION_PREFIXES);
}

export function isSystemAuditLog(
  entry: Pick<AuditLogEntry, 'action' | 'resource' | 'metadata'>,
): boolean {
  if (isIntegrationAuditLog(entry) || isAccountingAuditLog(entry)) {
    return false;
  }
  if (actionStartsWithAny(entry.action, SYSTEM_ACTION_PREFIXES)) {
    return true;
  }
  if (
    entry.action === 'queue.job_failed' ||
    entry.action === 'DATA_EXPORT_REQUESTED'
  ) {
    return true;
  }
  const orgModels = new Set(['Organization', 'User', 'Subscription', 'ApiKey']);
  return orgModels.has(entry.resource);
}

export function classifyAuditLogProductCategory(
  entry: Pick<AuditLogEntry, 'action' | 'resource' | 'metadata'>,
): Exclude<AuditLogProductCategory, 'all'> {
  if (isIntegrationAuditLog(entry)) {
    return 'integration';
  }
  if (isAccountingAuditLog(entry)) {
    return 'accounting';
  }
  return 'system';
}

export function auditLogMatchesProductCategory(
  entry: Pick<AuditLogEntry, 'action' | 'resource' | 'metadata'>,
  category: AuditLogProductCategory,
): boolean {
  if (category === 'all') {
    return true;
  }
  return classifyAuditLogProductCategory(entry) === category;
}

export interface FilterAuditLogsOptions {
  orgProducts: OrgProductLine[] | undefined;
  productCategory: AuditLogProductCategory;
}

/** Müşteri paneli görünümü — accounting-only'de pazaryeri kayıtları dışlanır */
export function filterAuditLogsForDisplay(
  logs: AuditLogEntry[],
  options: FilterAuditLogsOptions,
): AuditLogEntry[] {
  const { orgProducts, productCategory } = options;
  return logs.filter((entry) => {
    if (isAccountingOnlyOrg(orgProducts) && isIntegrationAuditLog(entry)) {
      return false;
    }
    return auditLogMatchesProductCategory(entry, productCategory);
  });
}

export function showAuditLogProductCategoryChips(
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return isBundleOrg(orgProducts);
}

export const AUDIT_LOG_PRODUCT_CATEGORY_OPTIONS: {
  value: AuditLogProductCategory;
  label: string;
}[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'integration', label: 'Entegrasyon' },
  { value: 'accounting', label: 'Muhasebe' },
  { value: 'system', label: 'Sistem' },
];

export function buildAuditLogProductCategoryOptions(
  orgProducts: OrgProductLine[] | undefined,
): { value: AuditLogProductCategory; label: string }[] {
  if (isAccountingOnlyOrg(orgProducts)) {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'accounting', label: 'Muhasebe' },
      { value: 'system', label: 'Sistem' },
    ];
  }
  if (isIntegrationOnlyOrg(orgProducts)) {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'integration', label: 'Entegrasyon' },
      { value: 'system', label: 'Sistem' },
    ];
  }
  return AUDIT_LOG_PRODUCT_CATEGORY_OPTIONS;
}

export type AuditLogActionPreset = { value: string; label: string };

const BASE_ACTION_PRESETS: AuditLogActionPreset[] = [
  { value: '', label: 'Tüm eylemler' },
  { value: 'auth.*', label: 'Kimlik ve güvenlik' },
  { value: 'users.*', label: 'Kullanıcı yönetimi' },
  { value: 'subscription.*', label: 'Abonelik' },
  { value: 'partner.*', label: 'Partner' },
  { value: 'email.*', label: 'E-posta' },
  { value: 'erp.*', label: 'ERP / fatura' },
  { value: 'sync_*', label: 'Senkronizasyon' },
];

export function buildAuditLogActionPresets(
  orgProducts: OrgProductLine[] | undefined,
): AuditLogActionPreset[] {
  if (isAccountingOnlyOrg(orgProducts)) {
    return BASE_ACTION_PRESETS.filter((p) => p.value !== 'sync_*');
  }
  if (isIntegrationOnlyOrg(orgProducts)) {
    return BASE_ACTION_PRESETS.filter((p) => p.value !== 'erp.*');
  }
  return BASE_ACTION_PRESETS;
}

export function auditLogsPageSubtitle(
  orgProducts: OrgProductLine[] | undefined,
): string {
  if (isAccountingOnlyOrg(orgProducts)) {
    return 'Muhasebe, abonelik ve güvenlik işlemlerinin kaydı; pazaryeri denetim kayıtları gösterilmez.';
  }
  if (isBundleOrg(orgProducts)) {
    return 'Entegrasyon, muhasebe ve sistem işlemlerini kategoriye göre filtreleyin.';
  }
  return 'Pazaryeri senkronizasyonu ve yönetimsel işlemlerin kaydı.';
}
