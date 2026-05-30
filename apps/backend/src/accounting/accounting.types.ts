import type { InvoiceStatus } from '@prisma/client';

import type { SerializedInvoice } from '../invoice/invoice.types';

/** Kesilmiş fatura — veritabanında `SENT` durumu */
export type AccountingInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'PAID' | 'OVERDUE';

export function toAccountingStatus(status: InvoiceStatus): AccountingInvoiceStatus {
  if (status === 'SENT') {
    return 'ISSUED';
  }
  return status as AccountingInvoiceStatus;
}

export type AccountingOverview = {
  openInvoiceCount: number;
  openInvoiceTotal: string;
  /** Cari borç toplamı (`CustomersBalanceSummary.totalDebit`) */
  openReceivablesAmount: string;
  /** E-postalı cari sayısı (`CustomersBalanceSummary.customerCount`) */
  customerCount: number;
  collectedTotal: string;
  collectedCount: number;
  vatSummary: {
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
  };
  currency: string;
};

/** `GET /accounting/revenue-trend?months=6` */
export type AccountingRevenueTrendPoint = {
  month: string;
  totalAmount: string;
  invoiceCount: number;
};

export type AccountingRevenueTrend = {
  months: number;
  currency: string;
  points: AccountingRevenueTrendPoint[];
};

/** `GET /accounting/vat-summary?month=YYYY-MM` */
export type AccountingVatSummary = {
  month: string;
  invoiceCount: number;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
};

export type CustomerBalanceSummary = {
  receivable: string;
  collected: string;
  netBalance: string;
  currency: string;
};

/** Müşteri listesi — borç (receivable), alacak (collected), bakiye (net) */
export type CustomerLedgerSummary = {
  debit: string;
  credit: string;
  balance: string;
  currency: string;
};

export type CustomerLedgerSummariesMap = Record<string, CustomerLedgerSummary>;

/** `GET /accounting/customers/balance-summary` — tüm cariler toplamı */
export type CustomersBalanceSummary = {
  totalDebit: string;
  totalCredit: string;
  netBalance: string;
  customerCount: number;
  currency: string;
};

export type LedgerEntryType = 'INVOICE' | 'PAYMENT';

export type LedgerEntry = {
  id: string;
  date: string;
  type: LedgerEntryType;
  description: string;
  debit: string;
  credit: string;
  referenceId: string;
  referenceType: 'invoice';
  status: AccountingInvoiceStatus;
};

export type CustomerStatement = {
  customerId: string;
  customerName: string;
  balance: CustomerBalanceSummary;
  entries: LedgerEntry[];
  invoices: SerializedInvoice[];
};

export type PushToErpResult = {
  erpInvoiceId: string;
  invoiceNumber: string;
  erpType: string;
  connectionId: string;
};

export type AccountingBulkResult = {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
};

/** `GET /accounting/inventory-valuation?warehouseId=` */
export type AccountingInventoryValuation = {
  warehouseId: string | null;
  totalQuantity: number;
  totalValue: string;
  skuCount: number;
  currency: string;
};
