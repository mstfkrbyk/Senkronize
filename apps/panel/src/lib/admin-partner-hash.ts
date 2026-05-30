const PARTNER_HASH_PREFIX = 'partner-';

/** CUID benzeri org id — geçersiz anchor/hash çökmesini önler */
function isPartnerOrgId(value: string): boolean {
  return /^[a-z0-9]{20,}$/i.test(value);
}

/** `#partner-{orgId}` — AdminPartnersPage satır anchor */
export function partnerOrgIdFromPageHash(hash: string): string | null {
  if (typeof hash !== 'string' || hash.length === 0) {
    return null;
  }
  const normalized = hash.replace(/^#/, '').trim();
  if (!normalized.startsWith(PARTNER_HASH_PREFIX)) {
    return null;
  }
  const id = normalized.slice(PARTNER_HASH_PREFIX.length).trim();
  if (!id || !isPartnerOrgId(id)) {
    return null;
  }
  return id;
}
