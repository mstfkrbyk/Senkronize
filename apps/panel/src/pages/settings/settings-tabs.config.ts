import type { AccountingMode } from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export const SETTINGS_TAB_IDS = [
  'profile',
  'security',
  'notifications',
  'subscription',
  'team',
  'api-keys',
  'webhooks',
  'currency',
  'invoice-numbering',
  'erp-sync',
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
  tabs: SettingsTabDefinition[];
}

const GENERAL_TABS: SettingsTabDefinition[] = [
  { id: 'profile', labelKey: 'settings.profile' },
  { id: 'security', labelKey: 'settings.security' },
  { id: 'notifications', labelKey: 'settings.notifications' },
  { id: 'subscription', labelKey: 'settings.subscription' },
  { id: 'team', labelKey: 'settings.teamMembers' },
];

const INTEGRATION_TABS: SettingsTabDefinition[] = [
  { id: 'api-keys', labelKey: 'settings.apiKeys' },
  { id: 'webhooks', labelKey: 'settings.webhooks' },
];

const ACCOUNTING_TABS: SettingsTabDefinition[] = [
  { id: 'currency', labelKey: 'settings.currency' },
  { id: 'invoice-numbering', labelKey: 'settings.invoiceNumbering' },
];

const EXTERNAL_ERP_TABS: SettingsTabDefinition[] = [
  { id: 'erp-sync', labelKey: 'settings.erpSync' },
];

export function isSettingsTabId(value: string | null): value is SettingsTabId {
  return value != null && (SETTINGS_TAB_IDS as readonly string[]).includes(value);
}

export function resolveSettingsSections(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): SettingsSectionDefinition[] {
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');
  const sections: SettingsSectionDefinition[] = [
    {
      id: 'general',
      labelKey: 'settings.sections.general',
      tabs: GENERAL_TABS,
    },
  ];

  if (hasIntegration) {
    sections.push({
      id: 'integration',
      labelKey: 'settings.sections.integration',
      tabs: INTEGRATION_TABS,
    });
  }

  if (hasAccounting && accountingMode === 'NATIVE') {
    sections.push({
      id: 'accounting',
      labelKey: 'settings.sections.accounting',
      tabs: ACCOUNTING_TABS,
    });
  }

  if (
    accountingMode === 'EXTERNAL_ERP' &&
    (hasAccounting || hasIntegration)
  ) {
    sections.push({
      id: 'externalErp',
      labelKey: 'settings.sections.externalErp',
      tabs: EXTERNAL_ERP_TABS,
    });
  }

  return sections;
}

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
