/** `GET /accounting/overview` — backend `AccountingOverview` ile aynı şema */
export interface AccountingOverviewVatSummary {
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
}

export interface AccountingOverview {
  openInvoiceCount: number;
  openInvoiceTotal: string;
  openReceivablesAmount: string;
  customerCount: number;
  collectedTotal: string;
  collectedCount: number;
  vatSummary: AccountingOverviewVatSummary;
  currency: string;
}

export interface AccountingOverviewResponse {
  data: AccountingOverview;
}

/** `GET /accounting/revenue-trend?months=6` */
export interface AccountingRevenueTrendPoint {
  month: string;
  totalAmount: string;
  invoiceCount: number;
}

export interface AccountingRevenueTrend {
  months: number;
  currency: string;
  points: AccountingRevenueTrendPoint[];
}

export interface AccountingRevenueTrendResponse {
  data: AccountingRevenueTrend;
}
