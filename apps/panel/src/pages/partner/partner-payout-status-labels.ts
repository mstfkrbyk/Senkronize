import type { PartnerPayoutRequestStatus } from '@/types/partner';

const LABELS: Record<PartnerPayoutRequestStatus, string> = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

export function partnerPayoutStatusLabel(status: string): string {
  if (status in LABELS) {
    return LABELS[status as PartnerPayoutRequestStatus];
  }
  return status;
}
