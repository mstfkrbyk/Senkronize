import { describe, expect, it } from 'vitest';

import {
  formatSettingsNavContext,
  isSettingsRoute,
  resolveSettingsSubPageTitle,
  SETTINGS_WEBHOOK_DETAIL_LABEL,
} from './settings-nav-context';

describe('settings-nav-context', () => {
  it('isSettingsRoute matches /settings and children', () => {
    expect(isSettingsRoute('/settings')).toBe(true);
    expect(isSettingsRoute('/settings/profile')).toBe(true);
    expect(isSettingsRoute('/orders')).toBe(false);
  });

  it('formatSettingsNavContext builds group > page', () => {
    expect(formatSettingsNavContext('Ortak', 'Ayarlar')).toBe('Ortak > Ayarlar');
    expect(formatSettingsNavContext(undefined, 'Ayarlar')).toBe('Ayarlar');
  });

  it('formatSettingsNavContext builds group > page > leaf for detail routes', () => {
    expect(
      formatSettingsNavContext('Ortak', 'Ayarlar', SETTINGS_WEBHOOK_DETAIL_LABEL),
    ).toBe('Ortak > Ayarlar > Webhook detay');
    expect(
      formatSettingsNavContext(undefined, 'Ayarlar', SETTINGS_WEBHOOK_DETAIL_LABEL),
    ).toBe('Ayarlar > Webhook detay');
  });

  it('resolveSettingsSubPageTitle returns leaf labels only for sub-routes', () => {
    expect(resolveSettingsSubPageTitle('/settings')).toBeUndefined();
    expect(resolveSettingsSubPageTitle('/settings/profile')).toBe('Profil');
    expect(resolveSettingsSubPageTitle('/settings/notifications')).toBe(
      'Bildirim tercihleri',
    );
    expect(resolveSettingsSubPageTitle('/settings/team')).toBe('Ekip Üyeleri');
    expect(resolveSettingsSubPageTitle('/settings/subscription')).toBe('Abonelik');
    expect(resolveSettingsSubPageTitle('/settings/partners')).toBe('Partnerler');
    expect(resolveSettingsSubPageTitle('/settings/webhooks/abc-123')).toBe(
      SETTINGS_WEBHOOK_DETAIL_LABEL,
    );
  });

  it('formatSettingsNavContext includes partners discovery leaf', () => {
    expect(
      formatSettingsNavContext('Ortak', 'Ayarlar', 'Partnerler'),
    ).toBe('Ortak > Ayarlar > Partnerler');
  });

  it('formatSettingsNavContext includes subscription leaf', () => {
    expect(
      formatSettingsNavContext('Ortak', 'Ayarlar', 'Abonelik'),
    ).toBe('Ortak > Ayarlar > Abonelik');
    expect(formatSettingsNavContext(undefined, 'Ayarlar', 'Abonelik')).toBe(
      'Ayarlar > Abonelik',
    );
  });
});
