import { IntegrationPolicyCategory, SyncFrequency } from '@prisma/client';

export type IntegrationPolicyFieldType =
  | 'number'
  | 'hour'
  | 'syncFrequency'
  | 'boolean';

export interface IntegrationPolicyFieldSchema {
  key: IntegrationPolicyFieldKey;
  label: string;
  description?: string;
  type: IntegrationPolicyFieldType;
  min?: number;
  max?: number;
  section: 'sync' | 'rateLimit' | 'general';
}

export type IntegrationPolicyFieldKey =
  | 'enabled'
  | 'orderSyncIntervalMinutes'
  | 'orderLookbackMinutes'
  | 'listingSyncIntervalMinutes'
  | 'maxRequestsPerHour'
  | 'requestsPerMinute'
  | 'syncFrequency';

export interface IntegrationRegistryEntry {
  platformKey: string;
  category: IntegrationPolicyCategory;
  displayName: string;
  fields: IntegrationPolicyFieldSchema[];
}

export const GLOBAL_POLICY_DEFAULTS = {
  orderSyncIntervalMinutes: 30,
  orderLookbackMinutes: 35,
  listingSyncIntervalMinutes: 60,
  maxRequestsPerHour: 10,
  syncFrequency: SyncFrequency.HOURLY,
} as const;

const SYNC_FIELDS: IntegrationPolicyFieldSchema[] = [
  {
    key: 'orderSyncIntervalMinutes',
    label: 'Sipariş sync aralığı (dk)',
    description: 'Bu entegrasyon için sipariş çekme sıklığı.',
    type: 'number',
    min: 5,
    max: 1440,
    section: 'sync',
  },
  {
    key: 'orderLookbackMinutes',
    label: 'Sipariş geriye bakış (dk)',
    description: 'Her sync’te sorgulanacak zaman penceresi.',
    type: 'number',
    min: 5,
    max: 1440,
    section: 'sync',
  },
  {
    key: 'listingSyncIntervalMinutes',
    label: 'İlan sync aralığı (dk)',
    description: 'Platformdan ilan listesi çekme sıklığı (yeni/güncel/kaldırılan ilanlar).',
    type: 'number',
    min: 5,
    max: 1440,
    section: 'sync',
  },
];

const RATE_FIELDS: IntegrationPolicyFieldSchema[] = [
  {
    key: 'requestsPerMinute',
    label: 'Dakikalık istek limiti (RPM)',
    description: 'Platform API rate limit tavanı.',
    type: 'number',
    min: 1,
    max: 600,
    section: 'rateLimit',
  },
  {
    key: 'maxRequestsPerHour',
    label: 'Saatlik istek limiti',
    description: 'Saatlik kota (ör. BizimHesap).',
    type: 'number',
    min: 1,
    max: 3600,
    section: 'rateLimit',
  },
];

const ERP_FIELDS: IntegrationPolicyFieldSchema[] = [
  {
    key: 'syncFrequency',
    label: 'ERP sync sıklığı',
    type: 'syncFrequency',
    section: 'sync',
  },
  ...RATE_FIELDS.filter((f) => f.key === 'maxRequestsPerHour'),
];

const GENERAL_ENABLED: IntegrationPolicyFieldSchema = {
  key: 'enabled',
  label: 'Entegrasyon aktif',
  description: 'Kapalıyken otomatik sync planlanmaz.',
  type: 'boolean',
  section: 'general',
};

export const INTEGRATION_REGISTRY: IntegrationRegistryEntry[] = [
  {
    platformKey: 'TRENDYOL',
    category: IntegrationPolicyCategory.MARKETPLACE,
    displayName: 'Trendyol',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'HEPSIBURADA',
    category: IntegrationPolicyCategory.MARKETPLACE,
    displayName: 'Hepsiburada',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'N11',
    category: IntegrationPolicyCategory.MARKETPLACE,
    displayName: 'N11',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'TICIMAX',
    category: IntegrationPolicyCategory.ECOMMERCE,
    displayName: 'Ticimax',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'WOOCOMMERCE',
    category: IntegrationPolicyCategory.ECOMMERCE,
    displayName: 'WooCommerce',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'SHOPIFY',
    category: IntegrationPolicyCategory.ECOMMERCE,
    displayName: 'Shopify',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'IDEASOFT',
    category: IntegrationPolicyCategory.ECOMMERCE,
    displayName: 'İdeasoft',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'TSOFT',
    category: IntegrationPolicyCategory.ECOMMERCE,
    displayName: 'T-Soft',
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  },
  {
    platformKey: 'BIZIMHESAP',
    category: IntegrationPolicyCategory.ERP,
    displayName: 'BizimHesap',
    fields: [GENERAL_ENABLED, ...ERP_FIELDS],
  },
  {
    platformKey: 'PARASUT',
    category: IntegrationPolicyCategory.ERP,
    displayName: 'Paraşüt',
    fields: [GENERAL_ENABLED, ...ERP_FIELDS],
  },
  {
    platformKey: 'LOGO',
    category: IntegrationPolicyCategory.ERP,
    displayName: 'Logo',
    fields: [GENERAL_ENABLED, ...ERP_FIELDS],
  },
  {
    platformKey: 'MIKRO',
    category: IntegrationPolicyCategory.ERP,
    displayName: 'Mikro',
    fields: [GENERAL_ENABLED, ...ERP_FIELDS],
  },
];

export const INTEGRATION_REGISTRY_MAP = new Map(
  INTEGRATION_REGISTRY.map((entry) => [entry.platformKey, entry]),
);

export function resolveRegistryEntry(platformKey: string): IntegrationRegistryEntry {
  const key = platformKey.toUpperCase();
  const existing = INTEGRATION_REGISTRY_MAP.get(key);
  if (existing) {
    return existing;
  }
  return {
    platformKey: key,
    category: IntegrationPolicyCategory.MARKETPLACE,
    displayName: key,
    fields: [GENERAL_ENABLED, ...SYNC_FIELDS, ...RATE_FIELDS],
  };
}

export function categoryLabel(category: IntegrationPolicyCategory): string {
  switch (category) {
    case IntegrationPolicyCategory.ERP:
      return 'ERP';
    case IntegrationPolicyCategory.ECOMMERCE:
      return 'E-ticaret';
    default:
      return 'Pazaryeri';
  }
}
