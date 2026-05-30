import type { PartnerLinkStatus } from '@/types/admin';

/** Admin paneli ve partner/müşteri UI'da ortak durum etiketleri */
export const PARTNER_LINK_STATUS_LABEL: Record<PartnerLinkStatus, string> = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

export function partnerLinkStatusLabel(status: PartnerLinkStatus): string {
  return PARTNER_LINK_STATUS_LABEL[status] ?? 'Bilinmeyen';
}

export function partnerLinkStatusBadgeVariant(
  status: PartnerLinkStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PENDING':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'outline';
  }
}
