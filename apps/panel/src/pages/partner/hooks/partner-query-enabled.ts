import type { OrgType } from '@/types/auth';

export type PartnerQueriesEnabledInput = {
  isMePending: boolean;
  meOrgType?: OrgType;
  storeOrgType?: OrgType;
  isImpersonating?: boolean;
};

/**
 * Partner TanStack Query `enabled` — /me.organization.type öncelikli
 * (persist merge veya impersonation sonrası store'da type DIRECT kalabiliyordu).
 * İstekler: `api.ts` içinde `/partner/*` yollarında impersonation JWT kullanılmaz.
 */
export function isPartnerQueriesEnabled(input: PartnerQueriesEnabledInput): boolean {
  if (input.isMePending) {
    return false;
  }
  if (input.meOrgType === 'PARTNER') {
    return true;
  }
  return input.storeOrgType === 'PARTNER';
}

/**
 * Müşteri (DIRECT) partner keşfi ve bağlantı talebi — `GET/POST /partner/available-partners`, `link-request`, `my-partners`.
 * `/partner/*` istekleri bayi JWT ile gider; impersonation sırasında store DIRECT ise etkin kalır.
 *
 * Manuel regresyon:
 * 1. DIRECT org → Ayarlar → Partnerler sekmesi ve keşif sayfası veri yükler.
 * 2. PARTNER org (impersonation yok) → sekme görünmez; keşif rotası müşteri guard ile kullanılmaz.
 * 3. F5 sonrası store type DIRECT kalsa bile /me DIRECT ise sorgular açık kalır.
 */
export function isClientPartnerQueriesEnabled(input: PartnerQueriesEnabledInput): boolean {
  if (input.isMePending) {
    return false;
  }
  if (input.isImpersonating) {
    return true;
  }
  if (input.meOrgType === 'DIRECT') {
    return true;
  }
  if (input.meOrgType === 'PARTNER') {
    return false;
  }
  return Boolean(input.storeOrgType) && input.storeOrgType !== 'PARTNER';
}
