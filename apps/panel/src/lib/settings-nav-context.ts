import { BREADCRUMB_LABELS } from '@/constants/breadcrumb-routes';
import { formatNavPageContext } from '@/lib/nav-page-context';

const SETTINGS_PATH = '/settings';

export function isSettingsRoute(pathname: string): boolean {
  return pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
}

/** Üst bağlam: «Ortak > Ayarlar» veya «Ortak > Ayarlar > …» (grup yoksa Ayarlar / Ayarlar > …). */
export function formatSettingsNavContext(
  groupLabel: string | undefined,
  settingsPageLabel: string,
  leafLabel?: string,
): string {
  return formatNavPageContext(groupLabel, settingsPageLabel, leafLabel);
}

const WEBHOOK_DETAIL_PATH = /^\/settings\/webhooks\/[^/]+$/;

/** Dinamik webhook detay rotası için sabit alt başlık. */
export const SETTINGS_WEBHOOK_DETAIL_LABEL = 'Webhook detay';

/** Alt rota sayfa başlığı; ana `/settings` için `undefined`. */
export function resolveSettingsSubPageTitle(pathname: string): string | undefined {
  if (!isSettingsRoute(pathname) || pathname === SETTINGS_PATH) {
    return undefined;
  }
  if (WEBHOOK_DETAIL_PATH.test(pathname)) {
    return SETTINGS_WEBHOOK_DETAIL_LABEL;
  }
  return BREADCRUMB_LABELS[pathname];
}
