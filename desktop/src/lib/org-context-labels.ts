export type OrgProductLine = 'INTEGRATION' | 'ACCOUNTING';
export type AccountingMode = 'NATIVE' | 'EXTERNAL_ERP';

const PRODUCT_LINE_ORDER: readonly OrgProductLine[] = ['INTEGRATION', 'ACCOUNTING'];

const PRODUCT_LINE_SHORT: Record<OrgProductLine, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Muhasebe',
};

export const ACCOUNTING_MODE_SHORT: Record<AccountingMode, string> = {
  NATIVE: 'Yerel ön muhasebe',
  EXTERNAL_ERP: 'Harici ERP köprüsü',
};

export function normalizeProductLines(
  lines: readonly string[] | undefined,
): OrgProductLine[] {
  if (!lines?.length) {
    return [];
  }
  const set = new Set<OrgProductLine>();
  for (const raw of lines) {
    const key = raw.trim().toUpperCase();
    if (key === 'INTEGRATION' || key === 'ACCOUNTING') {
      set.add(key);
    }
  }
  return PRODUCT_LINE_ORDER.filter((line) => set.has(line));
}

export function formatProductLinesLabel(lines: readonly OrgProductLine[]): string | null {
  if (lines.length === 0) {
    return null;
  }
  if (lines.length === 2) {
    return 'Paket';
  }
  return PRODUCT_LINE_SHORT[lines[0]!];
}

export function formatAccountingModeLabel(mode: AccountingMode | null | undefined): string | null {
  if (mode === 'NATIVE' || mode === 'EXTERNAL_ERP') {
    return ACCOUNTING_MODE_SHORT[mode];
  }
  return null;
}

/** Tray / ayarlar için tek satır org özeti */
export function formatOrgContextLine(args: {
  productLines?: readonly string[];
  accountingMode?: string | null;
}): string | null {
  const lines = normalizeProductLines(args.productLines);
  const products = formatProductLinesLabel(lines);
  const mode = formatAccountingModeLabel(
    args.accountingMode === 'NATIVE' || args.accountingMode === 'EXTERNAL_ERP'
      ? args.accountingMode
      : null,
  );

  const hasAccountingLine = lines.includes('ACCOUNTING');

  if (products && mode && hasAccountingLine) {
    return `${products} · ${mode}`;
  }
  if (mode && (hasAccountingLine || lines.length === 0)) {
    return mode;
  }
  if (products) {
    return products;
  }
  return null;
}
