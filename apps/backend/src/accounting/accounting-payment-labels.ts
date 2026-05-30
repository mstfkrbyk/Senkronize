export const ACCOUNTING_PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'CARD',
  'CHECK',
  'OTHER',
] as const;

export type AccountingPaymentMethodLabel = (typeof ACCOUNTING_PAYMENT_METHODS)[number];

/** Cari ekstre tahsilat satırı açıklaması (Türkçe) */
export const ACCOUNTING_PAYMENT_METHOD_LABELS: Record<AccountingPaymentMethodLabel, string> = {
  BANK_TRANSFER: 'Banka havalesi',
  CASH: 'Nakit',
  CARD: 'Kredi / banka kartı',
  CHECK: 'Çek',
  OTHER: 'Diğer',
};

export function accountingPaymentMethodLabel(method: string | null): string | null {
  if (!method) {
    return null;
  }
  const label = ACCOUNTING_PAYMENT_METHOD_LABELS[method as AccountingPaymentMethodLabel];
  return label ?? method;
}
