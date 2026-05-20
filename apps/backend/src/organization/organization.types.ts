export interface InvoiceNumberingSettings {
  invoiceNumberPrefix: string;
  nextSequence: number;
}

export interface OrganizationMetadata {
  invoiceNumberPrefix?: string;
  nextSequence?: number;
  invoiceNumberYear?: number;
  [key: string]: unknown;
}

export function parseOrganizationMetadata(raw: unknown): OrganizationMetadata {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as OrganizationMetadata;
}

export function formatInvoiceNumber(
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
