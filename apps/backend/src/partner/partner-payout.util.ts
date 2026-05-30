import { ensureFiniteNumber } from '../common/ensure-array.util';

import type {
  PartnerPayoutRequestRow,
  PartnerPayoutRequestStatus,
} from './partner.types';

export const PARTNER_PAYOUT_REQUEST_ACTION = 'partner.payout_request';
export const ADMIN_PARTNER_PAYOUT_APPROVE_ACTION = 'admin.partner_payout_approve';
export const ADMIN_PARTNER_PAYOUT_REJECT_ACTION = 'admin.partner_payout_reject';

const PAYOUT_STATUSES = new Set<PartnerPayoutRequestStatus>([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export function parsePayoutRequestMetadata(metadata: unknown): {
  amountTRY: number;
  status: PartnerPayoutRequestStatus;
  reviewedAt: string | null;
} {
  const m =
    metadata !== null && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>)
      : {};
  const rawStatus = typeof m.status === 'string' ? m.status : 'PENDING';
  const status = PAYOUT_STATUSES.has(rawStatus as PartnerPayoutRequestStatus)
    ? (rawStatus as PartnerPayoutRequestStatus)
    : 'PENDING';
  return {
    amountTRY: ensureFiniteNumber(m.amountTRY, 0),
    status,
    reviewedAt:
      typeof m.reviewedAt === 'string' && m.reviewedAt.trim().length > 0
        ? m.reviewedAt
        : null,
  };
}

export function mapAuditLogToPayoutRequest(
  log: {
    id: string;
    actorOrgId: string;
    createdAt: Date;
    metadata: unknown;
  },
  partnerName?: string,
): PartnerPayoutRequestRow {
  const meta = parsePayoutRequestMetadata(log.metadata);
  return {
    id: log.id,
    partnerOrgId: log.actorOrgId,
    partnerName,
    amountTRY: meta.amountTRY,
    status: meta.status,
    createdAt: log.createdAt.toISOString(),
    reviewedAt: meta.reviewedAt,
  };
}
