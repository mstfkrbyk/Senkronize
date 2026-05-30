export interface InvoiceNumberingSettings {
  invoiceNumberPrefix: string;
  nextSequence: number;
  /**
   * NATIVE ön muhasebe: kargoya verildi/teslim edildiğinde taslak satış faturası.
   * Metadata yoksa veya !== false ise true (`resolveDefaultAutoInvoice`).
   */
  defaultAutoInvoice: boolean;
  /** Katalog eşleştirme anahtarı: barkod, SKU veya yalnızca manuel; kurulumda seçilmezse null */
  productMatchKey: ProductMatchKey | null;
}

export type ProductMatchKey = 'BARCODE' | 'SKU' | 'MANUAL';

export interface OrganizationMetadata {
  invoiceNumberPrefix?: string;
  nextSequence?: number;
  invoiceNumberYear?: number;
  defaultAutoInvoice?: boolean;
  productMatchKey?: ProductMatchKey;
  /** Platform / dahili org: abonelik faturalandırması üretilmez */
  billingExempt?: boolean;
  /** Sınırsız limit + ACTIVE abonelik önerilir */
  internalAccount?: boolean;
  [key: string]: unknown;
}

export function resolveDefaultAutoInvoice(metadata: unknown): boolean {
  const meta = parseOrganizationMetadata(metadata);
  return meta.defaultAutoInvoice !== false;
}

export function resolveProductMatchKey(metadata: unknown): ProductMatchKey | null {
  const meta = parseOrganizationMetadata(metadata);
  if (
    meta.productMatchKey === 'BARCODE' ||
    meta.productMatchKey === 'SKU' ||
    meta.productMatchKey === 'MANUAL'
  ) {
    return meta.productMatchKey;
  }
  return null;
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
