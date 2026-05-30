import type { AccountingMode } from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine, OrgType } from '@/types/auth';

export const SETTINGS_TAB_IDS = [
  'profile',
  'organization',
  'security',
  'notifications',
  'appearance',
  'subscription',
  'team',
  'partners',
  'api-keys',
  'webhooks',
  'accounting-mode',
  'currency',
  'invoice-numbering',
  'erp-sync',
  'product-matching',
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export type SettingsSectionId = 'general' | 'integration' | 'accounting' | 'externalErp';

export interface SettingsTabDefinition {
  id: SettingsTabId;
  labelKey: string;
}

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  labelKey: string;
  /** Bölüm başlığı altında gösterilen Türkçe açıklama (i18n anahtarı) */
  descriptionKey: string;
  tabs: SettingsTabDefinition[];
  /** Entegrasyon hattı yok; sekmeler yerine yükseltme kartı (accounting-only) */
  integrationUpgrade?: boolean;
}

/** Entegrasyon hattı gerektiren ayar sekmeleri */
export const INTEGRATION_SETTINGS_TAB_IDS = ['api-keys', 'webhooks'] as const;

export type IntegrationSettingsTabId =
  (typeof INTEGRATION_SETTINGS_TAB_IDS)[number];

export interface SettingsProductAccess {
  hasIntegration: boolean;
  hasAccounting: boolean;
  /** Yalnızca ACCOUNTING hattı — API anahtarı ve webhook sekmeleri kilitli */
  accountingOnly: boolean;
}

export function resolveSettingsProductAccess(
  orgProducts: OrgProductLine[] | undefined,
): SettingsProductAccess {
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');
  return {
    hasIntegration,
    hasAccounting,
    accountingOnly: hasAccounting && !hasIntegration,
  };
}

export function isIntegrationSettingsTab(
  value: string | null | undefined,
): value is IntegrationSettingsTabId {
  return (
    value != null &&
    (INTEGRATION_SETTINGS_TAB_IDS as readonly string[]).includes(value)
  );
}

/** ?tab=api-keys|webhooks — entegrasyon hattı olmadan derin bağlantı */
export function wantsIntegrationSettingsDeepLink(
  preferred: string | null | undefined,
  access: SettingsProductAccess,
): boolean {
  return access.accountingOnly && isIntegrationSettingsTab(preferred);
}

const GENERAL_TAB_BASE: SettingsTabDefinition[] = [
  { id: 'profile', labelKey: 'settings.tabs.profile' },
  { id: 'organization', labelKey: 'settings.tabs.organization' },
  { id: 'security', labelKey: 'settings.tabs.security' },
  { id: 'notifications', labelKey: 'settings.tabs.notifications' },
  { id: 'appearance', labelKey: 'settings.tabs.appearance' },
  { id: 'subscription', labelKey: 'settings.tabs.subscription' },
  { id: 'team', labelKey: 'settings.tabs.teamMembers' },
];

const PARTNERS_TAB: SettingsTabDefinition = {
  id: 'partners',
  labelKey: 'settings.tabs.partners',
};

function resolveGeneralTabs(orgType?: OrgType): SettingsTabDefinition[] {
  if (orgType === 'DIRECT') {
    return [...GENERAL_TAB_BASE, PARTNERS_TAB];
  }
  return GENERAL_TAB_BASE;
}

const INTEGRATION_TABS: SettingsTabDefinition[] = [
  { id: 'api-keys', labelKey: 'settings.tabs.apiKeys' },
  { id: 'webhooks', labelKey: 'settings.tabs.webhooks' },
  { id: 'product-matching', labelKey: 'settings.tabs.productMatching' },
];

const ACCOUNTING_MODE_TAB: SettingsTabDefinition = {
  id: 'accounting-mode',
  labelKey: 'settings.tabs.accountingMode',
};

const ACCOUNTING_TABS_NATIVE: SettingsTabDefinition[] = [
  { id: 'currency', labelKey: 'settings.tabs.currency' },
  { id: 'invoice-numbering', labelKey: 'settings.tabs.invoiceNumbering' },
];

const EXTERNAL_ERP_TABS: SettingsTabDefinition[] = [
  { id: 'erp-sync', labelKey: 'settings.tabs.erpSync' },
];

export function isSettingsTabId(value: string | null): value is SettingsTabId {
  return value != null && (SETTINGS_TAB_IDS as readonly string[]).includes(value);
}

/** Ayarlar sekmesi yerine ayrı rota kullanan sekmeler */
export const SETTINGS_TAB_DEDICATED_ROUTES: Partial<
  Record<SettingsTabId, string>
> = {
  profile: '/settings/profile',
  subscription: '/settings/subscription',
  team: '/settings/team',
  'product-matching': '/settings/product-matching',
  'erp-sync': '/settings/erp-sync',
};

/** ?tab= — ayrı rotası olan sekmeler için yönlendirme hedefi */
export function resolveSettingsDedicatedTabRedirect(
  tabParam: string | null,
): string | null {
  if (!tabParam || !isSettingsTabId(tabParam)) {
    return null;
  }
  return SETTINGS_TAB_DEDICATED_ROUTES[tabParam] ?? null;
}

/** Genel ayarlar sekmeleri (?tab=) */
export function resolveSettingsTabsLink(tabId: SettingsTabId): string {
  return `/settings?tab=${tabId}`;
}

/** Sekme tıklaması veya yönlendirme için hedef URL (ayrı sayfa varsa o rota) */
export function resolveSettingsTabHref(tabId: SettingsTabId): string {
  return SETTINGS_TAB_DEDICATED_ROUTES[tabId] ?? resolveSettingsTabsLink(tabId);
}

/**
 * Ayar sekmeleri ürün hatları ve muhasebe moduna göre gruplanır.
 *
 * | Bölüm | Ürün hattı | accountingMode |
 * |-------|------------|----------------|
 * | integration | INTEGRATION | (moddan bağımsız) |
 * | accounting | ACCOUNTING | NATIVE — fatura/cari panelde |
 * | externalErp | ACCOUNTING veya INTEGRATION | EXTERNAL_ERP — harici programa köprü |
 *
 * NATIVE: Mod seçimi her zaman «Ön muhasebe» bölümünde; para birimi ve fatura numarası yalnızca NATIVE modda.
 * EXTERNAL_ERP: Aktif ERP bağlantısı veya org modu harici; senkron «Harici ERP» bölümünde.
 */
export function resolveSettingsSections(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
  orgType?: OrgType,
): SettingsSectionDefinition[] {
  const access = resolveSettingsProductAccess(orgProducts);
  const { hasIntegration, hasAccounting, accountingOnly } = access;
  const sections: SettingsSectionDefinition[] = [
    {
      id: 'general',
      labelKey: 'settings.sections.general',
      descriptionKey: 'settings.sections.generalHint',
      tabs: resolveGeneralTabs(orgType),
    },
  ];

  if (hasIntegration) {
    sections.push({
      id: 'integration',
      labelKey: 'settings.sections.integration',
      descriptionKey: 'settings.sections.integrationHint',
      tabs: INTEGRATION_TABS,
    });
  } else if (accountingOnly && hasAccounting) {
    sections.push({
      id: 'integration',
      labelKey: 'settings.sections.integration',
      descriptionKey: 'settings.sections.integrationHint',
      tabs: [],
      integrationUpgrade: true,
    });
  }

  if (hasAccounting) {
    const accountingTabs: SettingsTabDefinition[] = [ACCOUNTING_MODE_TAB];
    if (accountingMode === 'NATIVE') {
      accountingTabs.push(...ACCOUNTING_TABS_NATIVE);
    }
    sections.push({
      id: 'accounting',
      labelKey: 'settings.sections.accounting',
      descriptionKey: 'settings.sections.accountingHint',
      tabs: accountingTabs,
    });
  }

  if (
    accountingMode === 'EXTERNAL_ERP' &&
    (hasAccounting || hasIntegration)
  ) {
    sections.push({
      id: 'externalErp',
      labelKey: 'settings.sections.externalErp',
      descriptionKey: 'settings.sections.externalErpHint',
      tabs: EXTERNAL_ERP_TABS,
    });
  }

  return sections;
}

/** Sayfa alt başlığı: muhasebe modu veya entegrasyon kapsamına göre */
export function resolveSettingsSubtitleKey(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): string | null {
  const { hasIntegration, hasAccounting } = resolveSettingsProductAccess(orgProducts);
  if (!hasAccounting && !hasIntegration) {
    return null;
  }
  if (accountingMode === 'EXTERNAL_ERP') {
    return 'settings.subtitle.externalErp';
  }
  if (hasAccounting) {
    return 'settings.subtitle.nativeAccounting';
  }
  return 'settings.subtitle.integrationOnly';
}

export const SETTINGS_SUBTITLE_DEFAULT_KEY = 'settings.subtitle.default';

export function visibleSettingsTabIds(
  sections: SettingsSectionDefinition[],
): SettingsTabId[] {
  return sections.flatMap((s) => s.tabs.map((t) => t.id));
}

export function defaultSettingsTab(
  sections: SettingsSectionDefinition[],
  preferred?: string | null,
): SettingsTabId {
  const visible = visibleSettingsTabIds(sections);
  if (preferred && isSettingsTabId(preferred) && visible.includes(preferred)) {
    return preferred;
  }
  return visible[0] ?? 'profile';
}

function isInlineSettingsTab(tabId: SettingsTabId): boolean {
  return SETTINGS_TAB_DEDICATED_ROUTES[tabId] == null;
}

/** `/settings` sekmeli görünümü: ayrı rotası olan sekmeler atlanır */
export function defaultInlineSettingsTab(
  sections: SettingsSectionDefinition[],
  preferred?: string | null,
): SettingsTabId {
  const visible = visibleSettingsTabIds(sections);
  if (
    preferred &&
    isSettingsTabId(preferred) &&
    visible.includes(preferred) &&
    isInlineSettingsTab(preferred)
  ) {
    return preferred;
  }
  return visible.find(isInlineSettingsTab) ?? visible[0] ?? 'profile';
}
