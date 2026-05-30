import { describe, expect, it } from 'vitest';

import {
  defaultInlineSettingsTab,
  isIntegrationSettingsTab,
  resolveSettingsProductAccess,
  resolveSettingsSections,
  resolveSettingsSubtitleKey,
  resolveSettingsDedicatedTabRedirect,
  resolveSettingsTabHref,
  resolveSettingsTabsLink,
  visibleSettingsTabIds,
  wantsIntegrationSettingsDeepLink,
} from './settings-tabs.config';

describe('resolveSettingsSections', () => {
  it('boş orgProducts varsayılan hatları kullanır (entegrasyon + muhasebe)', () => {
    const sections = resolveSettingsSections([], 'NATIVE');
    expect(sections.map((s) => s.id)).toEqual([
      'general',
      'integration',
      'accounting',
    ]);
  });

  it('INTEGRATION hattında entegrasyon bölümünü ekler', () => {
    const sections = resolveSettingsSections(['INTEGRATION'], 'NATIVE');
    expect(sections.map((s) => s.id)).toEqual(['general', 'integration']);
  });

  it('NATIVE + ACCOUNTING: ön muhasebe, entegrasyon yükseltme, API/webhook gizli', () => {
    const sections = resolveSettingsSections(['ACCOUNTING'], 'NATIVE');
    expect(sections.map((s) => s.id)).toEqual([
      'general',
      'integration',
      'accounting',
    ]);
    const integration = sections.find((s) => s.id === 'integration');
    expect(integration?.integrationUpgrade).toBe(true);
    expect(integration?.tabs).toHaveLength(0);
    const visible = visibleSettingsTabIds(sections);
    expect(visible).toContain('accounting-mode');
    expect(visible).toContain('currency');
    expect(visible).not.toContain('api-keys');
    expect(visible).not.toContain('webhooks');
    expect(visible).not.toContain('erp-sync');
  });

  it('EXTERNAL_ERP + ACCOUNTING: ön muhasebe mod sekmesi + harici ERP', () => {
    const sections = resolveSettingsSections(['ACCOUNTING'], 'EXTERNAL_ERP');
    expect(sections.map((s) => s.id)).toEqual([
      'general',
      'integration',
      'accounting',
      'externalErp',
    ]);
    expect(visibleSettingsTabIds(sections)).toContain('accounting-mode');
    expect(visibleSettingsTabIds(sections)).toContain('erp-sync');
    expect(visibleSettingsTabIds(sections)).not.toContain('currency');
  });

  it('EXTERNAL_ERP + yalnız INTEGRATION: entegrasyon ve harici ERP', () => {
    const sections = resolveSettingsSections(['INTEGRATION'], 'EXTERNAL_ERP');
    expect(sections.map((s) => s.id)).toEqual([
      'general',
      'integration',
      'externalErp',
    ]);
  });
});

describe('resolveSettingsSubtitleKey', () => {
  it('varsayılan hatlarla NATIVE için nativeAccounting anahtarı', () => {
    expect(resolveSettingsSubtitleKey([], 'NATIVE')).toBe(
      'settings.subtitle.nativeAccounting',
    );
  });

  it('NATIVE muhasebe için nativeAccounting anahtarı', () => {
    expect(resolveSettingsSubtitleKey(['ACCOUNTING'], 'NATIVE')).toBe(
      'settings.subtitle.nativeAccounting',
    );
  });

  it('EXTERNAL_ERP için externalErp anahtarı', () => {
    expect(
      resolveSettingsSubtitleKey(['ACCOUNTING', 'INTEGRATION'], 'EXTERNAL_ERP'),
    ).toBe('settings.subtitle.externalErp');
  });
});

describe('resolveSettingsProductAccess', () => {
  it('hatları doğru çözümler', () => {
    expect(resolveSettingsProductAccess(['INTEGRATION', 'ACCOUNTING'])).toEqual({
      hasIntegration: true,
      hasAccounting: true,
      accountingOnly: false,
    });
  });

  it('yalnız ACCOUNTING: accountingOnly', () => {
    expect(resolveSettingsProductAccess(['ACCOUNTING'])).toEqual({
      hasIntegration: false,
      hasAccounting: true,
      accountingOnly: true,
    });
  });
});

describe('settings tab hrefs', () => {
  it('profile, subscription and team use dedicated routes; others use ?tab=', () => {
    expect(resolveSettingsTabHref('profile')).toBe('/settings/profile');
    expect(resolveSettingsTabHref('subscription')).toBe('/settings/subscription');
    expect(resolveSettingsTabHref('team')).toBe('/settings/team');
    expect(resolveSettingsTabsLink('subscription')).toBe('/settings?tab=subscription');
    expect(resolveSettingsTabHref('security')).toBe('/settings?tab=security');
  });
});

describe('resolveSettingsDedicatedTabRedirect', () => {
  it('returns dedicated route for profile, team and subscription tab params', () => {
    expect(resolveSettingsDedicatedTabRedirect('profile')).toBe('/settings/profile');
    expect(resolveSettingsDedicatedTabRedirect('team')).toBe('/settings/team');
    expect(resolveSettingsDedicatedTabRedirect('subscription')).toBe(
      '/settings/subscription',
    );
  });

  it('returns null for inline tabs and invalid params', () => {
    expect(resolveSettingsDedicatedTabRedirect('security')).toBeNull();
    expect(resolveSettingsDedicatedTabRedirect(null)).toBeNull();
    expect(resolveSettingsDedicatedTabRedirect('invalid')).toBeNull();
  });
});

describe('defaultInlineSettingsTab', () => {
  it('skips dedicated-route tabs when no preferred tab', () => {
    const sections = resolveSettingsSections([], 'NATIVE');
    expect(defaultInlineSettingsTab(sections)).toBe('organization');
  });

  it('honors preferred inline tab', () => {
    const sections = resolveSettingsSections([], 'NATIVE');
    expect(defaultInlineSettingsTab(sections, 'notifications')).toBe('notifications');
  });

  it('ignores preferred dedicated tab', () => {
    const sections = resolveSettingsSections([], 'NATIVE');
    expect(defaultInlineSettingsTab(sections, 'profile')).toBe('organization');
  });
});

describe('integration settings deep link', () => {
  it('accounting-only + api-keys|webhooks', () => {
    const access = resolveSettingsProductAccess(['ACCOUNTING']);
    expect(isIntegrationSettingsTab('api-keys')).toBe(true);
    expect(isIntegrationSettingsTab('profile')).toBe(false);
    expect(wantsIntegrationSettingsDeepLink('webhooks', access)).toBe(true);
    expect(wantsIntegrationSettingsDeepLink('api-keys', access)).toBe(true);
    expect(wantsIntegrationSettingsDeepLink('api-keys', resolveSettingsProductAccess(['INTEGRATION']))).toBe(
      false,
    );
  });
});
