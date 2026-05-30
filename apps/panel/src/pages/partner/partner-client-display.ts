import type { PartnerRelationship } from '@/types/partner';

export interface PartnerClientDisplay {
  name: string;
  slug: string;
  orders30d: number | undefined;
  commissionPct: number;
  clientOrgId: string | null;
  canEnter: boolean;
}

function parseCommissionPct(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 10;
}

/** Kart ve satır etiketleri; normalize edilmiş ilişki üzerinden güvenli alanlar */
export function resolvePartnerClientDisplay(
  relationship: PartnerRelationship,
  invitePendingLabel: string,
): PartnerClientDisplay {
  const client = relationship.clientOrg;
  const orgName = client?.name?.trim();
  const email = relationship.invitedEmail?.trim();
  const name = orgName || email || invitePendingLabel;
  const slug = client?.slug?.trim() || '—';
  const orders30d =
    typeof relationship.orders30d === 'number' &&
    Number.isFinite(relationship.orders30d)
      ? Math.max(0, relationship.orders30d)
      : undefined;
  const clientOrgId =
    typeof relationship.clientOrgId === 'string' &&
    relationship.clientOrgId.trim().length > 0
      ? relationship.clientOrgId.trim()
      : null;

  return {
    name,
    slug,
    orders30d,
    commissionPct: parseCommissionPct(relationship.commissionPct),
    clientOrgId,
    canEnter:
      relationship.canImpersonate === true &&
      relationship.status === 'ACTIVE' &&
      clientOrgId != null &&
      client != null,
  };
}
