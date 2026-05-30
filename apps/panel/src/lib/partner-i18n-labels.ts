import type { TFunction } from 'i18next';

import i18n from '@/i18n';

type Translate = TFunction;

function defaultTranslate(key: string, options?: string | Record<string, unknown>): string {
  if (options !== undefined && typeof options === 'object') {
    return i18n.t(key, { lng: 'tr', ...options });
  }
  return i18n.t(key, {
    lng: 'tr',
    defaultValue: typeof options === 'string' ? options : undefined,
  });
}

function resolveT(t?: Translate): Translate {
  if (t) {
    return t;
  }
  return defaultTranslate as Translate;
}

export function partnerCommissionPaymentStatusLabel(
  status: 'pending' | 'paid',
  t?: Translate,
): string {
  return resolveT(t)(`partner.commission.paymentStatus.${status}`);
}

export function partnerCommissionLedgerStatusLabel(status: string, t?: Translate): string {
  const key = status.trim().toUpperCase();
  return resolveT(t)(`partner.commission.ledgerStatus.${key}`, {
    defaultValue: resolveT(t)('partner.commission.unknown'),
  });
}

export function partnerCommissionTypeLabel(type: string, t?: Translate): string {
  return resolveT(t)(`partner.commission.type.${type}`, {
    defaultValue: resolveT(t)('partner.commission.other'),
  });
}

export function partnerStatusLabel(status: string, t?: Translate): string {
  return resolveT(t)(`partner.status.${status}`, { defaultValue: status });
}
