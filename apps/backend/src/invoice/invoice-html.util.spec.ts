import { renderInvoiceHtml } from './invoice-html.util';
import type { InvoicePdfContext } from './invoice.types';

function baseContext(overrides?: Partial<InvoicePdfContext>): InvoicePdfContext {
  return {
    invoiceNumber: 'FTR-2026-000042',
    invoiceDate: '20 May 2026',
    dueDate: null,
    status: 'SENT',
    isEArchive: false,
    org: {
      name: 'Demo Mağaza A.Ş.',
      taxNumber: '1234567890',
      taxOffice: 'Kadıköy',
      address: 'Örnek Mah. No:1',
      city: 'İstanbul',
    },
    customerName: 'Ahmet Yılmaz',
    customerEmail: null,
    customerPhone: null,
    customerAddress: null,
    customerTaxId: null,
    items: [
      {
        name: 'Ürün A',
        quantity: 2,
        unitPrice: 100,
        taxRate: 20,
        taxAmount: 40,
        total: 240,
      },
      {
        name: 'Ürün B',
        quantity: 1,
        unitPrice: 50,
        taxRate: 10,
        taxAmount: 5,
        total: 55,
      },
    ],
    subtotal: '250',
    taxAmount: '45',
    taxRate: 20,
    totalAmount: '295',
    currency: 'TRY',
    notes: null,
    ...overrides,
  };
}

describe('renderInvoiceHtml', () => {
  it('organizasyon adı, fatura no ve KDV satırlarını şablona işler', () => {
    const html = renderInvoiceHtml(baseContext());

    expect(html).toContain('Demo Mağaza A.Ş.');
    expect(html).toContain('FTR-2026-000042');
    expect(html).toContain('KDV (%20)');
    expect(html).toContain('KDV (%10)');
    expect(html).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });
});
