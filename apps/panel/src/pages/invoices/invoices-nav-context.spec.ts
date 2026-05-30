import { describe, expect, it } from 'vitest';

import {
  formatInvoicesNavContext,
  INVOICE_CREATE_PAGE_LABEL,
  INVOICES_PAGE_LABEL,
  resolveInvoiceDetailBreadcrumbLabel,
  resolveInvoicesNavGroupLabel,
} from './invoices-nav-context';

const t = (key: string): string => {
  const map: Record<string, string> = {
    'nav.nativeAccounting': 'Ön Muhasebe',
  };
  return map[key] ?? key;
};

describe('invoices-nav-context', () => {
  it('formatInvoicesNavContext uses sidebar group when present', () => {
    expect(
      formatInvoicesNavContext('E-Ticaret', INVOICES_PAGE_LABEL, ['INTEGRATION'], t),
    ).toBe('E-Ticaret > Faturalar');
  });

  it('formatInvoicesNavContext falls back to Ön Muhasebe for accounting orgs', () => {
    expect(
      formatInvoicesNavContext(undefined, INVOICES_PAGE_LABEL, ['ACCOUNTING'], t),
    ).toBe('Ön Muhasebe > Faturalar');
  });

  it('resolveInvoicesNavGroupLabel returns undefined without accounting line', () => {
    expect(resolveInvoicesNavGroupLabel(undefined, ['INTEGRATION'], t)).toBeUndefined();
  });

  it('resolveInvoiceDetailBreadcrumbLabel prefers invoice number', () => {
    expect(resolveInvoiceDetailBreadcrumbLabel('FTR-2026-0042')).toBe('FTR-2026-0042');
    expect(resolveInvoiceDetailBreadcrumbLabel('')).toBe('Fatura detayı');
  });

  it('create page label constant is defined', () => {
    expect(INVOICE_CREATE_PAGE_LABEL).toBe('Yeni fatura');
  });
});
