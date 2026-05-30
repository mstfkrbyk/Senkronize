import type { TFunction } from 'i18next';

/** Platform (super-admin) org — backend `PLATFORM_ORG_SLUG` ile aynı. */
export const PLATFORM_ORG_SLUG = 'senkronize-platform';

export function getOrgDeleteBlockedReason(
  org: { slug: string; type?: string },
  t: TFunction,
): string | null {
  if (org.slug === PLATFORM_ORG_SLUG) {
    return t('admin.orgDelete.blocked.platform');
  }
  if (org.type === 'PARTNER') {
    return t('admin.orgDelete.blocked.partner');
  }
  return null;
}
