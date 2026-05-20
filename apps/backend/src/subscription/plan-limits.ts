import { PlanTier } from '@prisma/client';

export interface PlanLimitConfig {
  marketplaces: number;
  products: number;
  orders: number;
  users: number;
  warehouses: number;
  apiCallsPerDay: number;
  syncFrequencyMinutes: number;
  features: readonly string[];
}

/** Paket limitleri — `-1` sınırsız */
export const PLAN_LIMITS: Record<PlanTier, PlanLimitConfig> = {
  BASLANGIC: {
    marketplaces: 3,
    products: 1000,
    orders: 500,
    users: 2,
    warehouses: 1,
    apiCallsPerDay: 1000,
    syncFrequencyMinutes: 60,
    features: ['basic_sync', 'basic_reports'],
  },
  GELISIM: {
    marketplaces: 10,
    products: 10000,
    orders: 5000,
    users: 5,
    warehouses: 3,
    apiCallsPerDay: 10000,
    syncFrequencyMinutes: 15,
    features: [
      'basic_sync',
      'advanced_reports',
      'buybox',
      'multi_currency',
      'webhooks',
    ],
  },
  PRO: {
    marketplaces: 25,
    products: 50000,
    orders: 25000,
    users: 15,
    warehouses: 10,
    apiCallsPerDay: 100000,
    syncFrequencyMinutes: 5,
    features: [
      'all_sync',
      'advanced_reports',
      'buybox_ai',
      'multi_currency',
      'webhooks',
      'api_access',
      'custom_reports',
    ],
  },
  KURUMSAL: {
    marketplaces: -1,
    products: -1,
    orders: -1,
    users: -1,
    warehouses: -1,
    apiCallsPerDay: -1,
    syncFrequencyMinutes: 1,
    features: ['all'],
  },
} as const;

export const PLAN_TIER_RANK: Record<PlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

export function isUnlimitedLimit(value: number): boolean {
  return value < 0;
}

/** Panel/API — sınırsız için `null` */
export function toUsageLimit(value: number): number | null {
  return isUnlimitedLimit(value) ? null : value;
}

/** Abonelik kaydı güncellemesi için DB limit alanları */
export function dbLimitsForPlan(plan: PlanTier): {
  monthlyOrderLimit: number | null;
  marketplaceLimit: number | null;
  ecommerceLimit: number | null;
  erpLimit: number | null;
  userLimit: number | null;
} {
  const L = PLAN_LIMITS[plan];
  const toDb = (v: number): number | null => (isUnlimitedLimit(v) ? null : v);
  return {
    monthlyOrderLimit: toDb(L.orders),
    marketplaceLimit: toDb(L.marketplaces),
    ecommerceLimit: toDb(Math.min(L.marketplaces, 20)),
    erpLimit: toDb(L.warehouses),
    userLimit: toDb(L.users),
  };
}

export function planLimitFeatureLines(plan: PlanTier): string[] {
  const L = PLAN_LIMITS[plan];
  const fmt = (v: number, suffix = ''): string =>
    isUnlimitedLimit(v) ? 'Sınırsız' : `${v.toLocaleString('tr-TR')}${suffix}`;
  return [
    `Pazaryeri: ${fmt(L.marketplaces)}`,
    `Ürün: ${fmt(L.products)}`,
    `Sipariş: ${fmt(L.orders, '/ay')}`,
    `Kullanıcı: ${fmt(L.users)}`,
    `Depo: ${fmt(L.warehouses)}`,
    `Günlük API: ${fmt(L.apiCallsPerDay)}`,
  ];
}

export function effectiveLimit(
  stored: number | null | undefined,
  plan: PlanTier,
  key: keyof Pick<
    PlanLimitConfig,
    'marketplaces' | 'products' | 'orders' | 'users' | 'warehouses' | 'apiCallsPerDay'
  >,
): number {
  if (stored != null) {
    return stored;
  }
  return PLAN_LIMITS[plan][key];
}
