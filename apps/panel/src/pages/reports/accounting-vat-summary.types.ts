/** `GET /accounting/vat-summary?month=YYYY-MM` */
export interface AccountingVatSummary {
  month: string;
  invoiceCount: number;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
}

export interface AccountingVatSummaryResponse {
  data: AccountingVatSummary;
}
