import type { AdminOrgProductFilterValue } from '@/lib/admin-org-product-filter';

/** Seed / demo partner org slug'ları. */
export function isDemoPartnerSlug(slug: string | null | undefined): boolean {
  if (typeof slug !== 'string' || slug.length === 0) {
    return false;
  }
  return slug === 'demo-partner' || slug.startsWith('demo-');
}

export function adminPartnerRowAnchor(partnerOrgId: string | null | undefined): string {
  const id = typeof partnerOrgId === 'string' ? partnerOrgId.trim() : '';
  if (!id) {
    return 'partner-unknown';
  }
  return `partner-${id}`;
}

export function adminPartnerPageHash(partnerOrgId: string | null | undefined): string {
  const id = typeof partnerOrgId === 'string' ? partnerOrgId.trim() : '';
  if (!id) {
    return '';
  }
  return `#${adminPartnerRowAnchor(id)}`;
}

export function adminOrganizationsByPartnerUrl(
  partnerOrgId: string,
  product?: AdminOrgProductFilterValue,
): string {
  const params = new URLSearchParams({
    partner: partnerOrgId,
  });
  if (product && product !== 'all') {
    params.set('product', product);
  }
  return `/admin/organizations?${params.toString()}`;
}
