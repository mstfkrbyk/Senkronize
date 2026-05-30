import type { AccountingMode } from '@/lib/accounting-mode';

import {
  showExternalErpTab,
  type ConnectionsProductAccess,
} from './connections-product-access';

export const CONNECTION_TAB_IDS = [
  'marketplace',
  'ecommerce',
  'cargo',
  'erp',
] as const;

export type ConnectionTabId = (typeof CONNECTION_TAB_IDS)[number];

const INTEGRATION_CHANNEL_TAB_ORDER: ConnectionTabId[] = [
  'marketplace',
  'ecommerce',
  'cargo',
];

const TAB_LABEL_KEYS: Record<ConnectionTabId, string> = {
  marketplace: 'connections.tabs.marketplace',
  ecommerce: 'connections.tabs.ecommerce',
  cargo: 'connections.tabs.cargo',
  erp: 'connections.tabs.externalErp',
};

export interface ConnectionTabDefinition {
  id: ConnectionTabId;
  labelKey: string;
  group: 'channels' | 'externalErp';
}

export function resolveConnectionChannelTabs(
  access: ConnectionsProductAccess,
): ConnectionTabDefinition[] {
  if (!access.showIntegrationTabs) {
    return [];
  }
  return INTEGRATION_CHANNEL_TAB_ORDER.map((id) => ({
    id,
    labelKey: TAB_LABEL_KEYS[id],
    group: 'channels' as const,
  }));
}

export function resolveConnectionErpTab(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
): ConnectionTabDefinition | null {
  if (!showExternalErpTab(access, accountingMode)) {
    return null;
  }
  return {
    id: 'erp',
    labelKey: TAB_LABEL_KEYS.erp,
    group: 'externalErp',
  };
}

export function defaultConnectionTab(
  _access: ConnectionsProductAccess,
): ConnectionTabId {
  return 'marketplace';
}

export function isConnectionTabId(
  value: string,
  channelTabs: ConnectionTabDefinition[],
  erpTab: ConnectionTabDefinition | null,
): value is ConnectionTabId {
  if (channelTabs.some((t) => t.id === value)) {
    return true;
  }
  return erpTab?.id === value;
}

export type ConnectionsSubtitleKey =
  | 'connections.page.subtitleIntegration'
  | 'connections.page.subtitleBundleNative'
  | 'connections.page.subtitleAccountingNative'
  | 'connections.page.subtitleAccountingExternal';

export function resolveConnectionsSubtitleKey(
  access: ConnectionsProductAccess,
  accountingMode: AccountingMode,
): ConnectionsSubtitleKey {
  if (
    access.showIntegrationTabs &&
    access.hasAccounting &&
    accountingMode === 'NATIVE'
  ) {
    return 'connections.page.subtitleBundleNative';
  }
  if (access.accountingOnly) {
    return accountingMode === 'EXTERNAL_ERP'
      ? 'connections.page.subtitleAccountingExternal'
      : 'connections.page.subtitleAccountingNative';
  }
  return 'connections.page.subtitleIntegration';
}
