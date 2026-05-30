import type { InvoiceDto } from '@/types/invoice';

export interface AccountingOverviewKpiAmount {
  count: number;
  totalAmount: string;
}

export interface AccountingOverviewVatSummary {
  subtotal: string;
  taxAmount: string;
}

export interface AccountingBulkResult {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export interface AccountingOverviewDto {
  kpis: {
    issuedThisMonth: AccountingOverviewKpiAmount;
    collectedThisMonth: AccountingOverviewKpiAmount;
    pending: AccountingOverviewKpiAmount;
    vatThisMonth: AccountingOverviewVatSummary;
  };
  recentInvoices: InvoiceDto[];
}
