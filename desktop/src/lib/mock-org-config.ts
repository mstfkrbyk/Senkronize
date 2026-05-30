import { formatOrgContextLine } from '@/lib/org-context-labels';

function parseProductLinesEnv(raw: string | undefined): string[] | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.split(/[,;\s]+/).filter((part) => part.length > 0);
}

/** Geliştirme: Vite env ile org özeti (ör. seed demo-paket) */
export function readMockOrgConfigFromEnv(): {
  productLines?: string[];
  accountingMode?: string;
} | null {
  const productLines = parseProductLinesEnv(import.meta.env.VITE_DESKTOP_MOCK_PRODUCT_LINES);
  const accountingMode = import.meta.env.VITE_DESKTOP_MOCK_ACCOUNTING_MODE?.trim() || undefined;

  if (!productLines?.length && !accountingMode) {
    return null;
  }

  return {
    productLines,
    accountingMode,
  };
}

export function mockOrgContextLineFromEnv(): string | null {
  const mock = readMockOrgConfigFromEnv();
  if (!mock) {
    return null;
  }
  return formatOrgContextLine(mock);
}
