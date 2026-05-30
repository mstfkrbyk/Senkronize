export const INVOICE_NUMBER_PREFIX_MAX_LENGTH = 10;

const INVOICE_NUMBER_PREFIX_PATTERN = /^[A-Za-z0-9]*$/;

export function isInvoiceNumberPrefixValid(prefix: string): boolean {
  const trimmed = prefix.trim();
  return (
    trimmed.length <= INVOICE_NUMBER_PREFIX_MAX_LENGTH &&
    INVOICE_NUMBER_PREFIX_PATTERN.test(trimmed)
  );
}

export interface OrganizationSettings {
  invoiceNumberPrefix: string;
  nextSequence: number;
  /** GET /organizations/settings — NATIVE modda otomatik taslak fatura; API yoksa true */
  defaultAutoInvoice: boolean;
}

export interface PatchOrganizationSettings {
  invoiceNumberPrefix?: string;
  nextSequence?: number;
  /** PATCH — false ile kapatılır; panel OrderAutoInvoiceSettingsCard ile uyumlu */
  defaultAutoInvoice?: boolean;
}

export function formatInvoiceNumberPreview(
  prefix: string,
  year: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(6, '0');
  const trimmed = prefix.trim();
  if (!trimmed) {
    return `${year}/${padded}`;
  }
  return `${trimmed}-${year}-${padded}`;
}
