import type { TFunction } from 'i18next';

import {
  partnerCommissionLedgerStatusLabel,
  partnerCommissionPaymentStatusLabel,
  partnerCommissionTypeLabel,
} from '@/lib/partner-i18n-labels';

/** Komisyon ödeme durumu (özet tablosu) */
export type CommissionPaymentStatusLabel = 'pending' | 'paid';

export function commissionPaymentStatusLabel(
  status: CommissionPaymentStatusLabel,
  t?: TFunction,
): string {
  return partnerCommissionPaymentStatusLabel(status, t);
}

export function commissionLedgerStatusLabel(status: string, t?: TFunction): string {
  return partnerCommissionLedgerStatusLabel(status, t);
}

export function commissionTypeLabel(type: string, t?: TFunction): string {
  return partnerCommissionTypeLabel(type, t);
}

export function formatCommissionPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) {
    return '—';
  }
  return `%${pct}`;
}
