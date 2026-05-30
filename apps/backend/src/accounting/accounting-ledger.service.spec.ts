import { InvoiceStatus, Prisma } from '@prisma/client';

import { accountingPaymentMethodLabel } from './accounting-payment-labels';
import { AccountingLedgerService } from './accounting-ledger.service';

function mockInvoice(
  overrides: Partial<{
    id: string;
    status: InvoiceStatus;
    invoiceNumber: string;
    customerName: string;
    totalAmount: string;
    createdAt: Date;
    paidAt: Date | null;
    paymentMethod: string | null;
  }> = {},
) {
  const createdAt = overrides.createdAt ?? new Date('2026-05-01T12:00:00.000Z');
  return {
    id: 'inv-1',
    organizationId: 'org-1',
    invoiceNumber: 'SNK-2026-00001',
    customerName: 'Acme Ltd',
    totalAmount: new Prisma.Decimal(overrides.totalAmount ?? '1200'),
    status: overrides.status ?? InvoiceStatus.SENT,
    createdAt,
    paidAt: overrides.paidAt ?? null,
    paymentMethod: overrides.paymentMethod ?? null,
    ...overrides,
  } as Parameters<AccountingLedgerService['invoiceToLedgerEntries']>[0];
}

describe('AccountingLedgerService', () => {
  const service = new AccountingLedgerService();

  describe('accountingPaymentMethodLabel', () => {
    it('bilinen yöntemleri Türkçe etiket döner', () => {
      expect(accountingPaymentMethodLabel('BANK_TRANSFER')).toBe('Banka havalesi');
      expect(accountingPaymentMethodLabel('CASH')).toBe('Nakit');
    });

    it('null veya bilinmeyen değerde null veya ham değer döner', () => {
      expect(accountingPaymentMethodLabel(null)).toBeNull();
      expect(accountingPaymentMethodLabel('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('invoiceToLedgerEntries', () => {
    it('PAID fatura için fatura borç + tahsilat alacak satırı üretir', () => {
      const paidAt = new Date('2026-05-20T10:00:00.000Z');
      const invoice = mockInvoice({
        status: InvoiceStatus.PAID,
        paidAt,
        paymentMethod: 'BANK_TRANSFER',
      });

      const entries = service.invoiceToLedgerEntries(invoice);

      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        id: 'ledger-invoice-inv-1',
        type: 'INVOICE',
        debit: '1200',
        credit: '0',
        date: invoice.createdAt.toISOString(),
        description: 'SNK-2026-00001 — Acme Ltd',
      });
      expect(entries[1]).toMatchObject({
        id: 'ledger-payment-inv-1',
        type: 'PAYMENT',
        debit: '0',
        credit: '1200',
        date: paidAt.toISOString(),
        description: 'SNK-2026-00001 — Tahsilat (Banka havalesi)',
      });
    });

    it('PAID faturada paidAt yoksa tahsilat tarihi createdAt kullanılır', () => {
      const createdAt = new Date('2026-05-01T12:00:00.000Z');
      const invoice = mockInvoice({
        status: InvoiceStatus.PAID,
        createdAt,
        paidAt: null,
        paymentMethod: null,
      });

      const entries = service.invoiceToLedgerEntries(invoice);
      const payment = entries.find((e) => e.type === 'PAYMENT');

      expect(payment?.date).toBe(createdAt.toISOString());
      expect(payment?.description).toBe('SNK-2026-00001 — Tahsilat');
    });

    it('SENT fatura için tek borç satırı üretir', () => {
      const entries = service.invoiceToLedgerEntries(
        mockInvoice({ status: InvoiceStatus.SENT }),
      );

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'INVOICE',
        debit: '1200',
        credit: '0',
        status: 'ISSUED',
      });
    });
  });

  describe('buildLedgerFromInvoices', () => {
    it('iptal faturaları hariç tutar ve tarihe göre azalan sıralar', () => {
      const entries = service.buildLedgerFromInvoices([
        mockInvoice({
          id: 'inv-old',
          status: InvoiceStatus.SENT,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        mockInvoice({
          id: 'inv-paid',
          status: InvoiceStatus.PAID,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          paidAt: new Date('2026-05-15T00:00:00.000Z'),
          paymentMethod: 'CASH',
        }),
        mockInvoice({
          id: 'inv-cancel',
          status: InvoiceStatus.CANCELLED,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ]);

      expect(entries.some((e) => e.referenceId === 'inv-cancel')).toBe(false);
      expect(entries[0]?.date >= entries[entries.length - 1]?.date).toBe(true);
      expect(entries.filter((e) => e.referenceId === 'inv-paid')).toHaveLength(2);
    });
  });
});
