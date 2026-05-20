export interface VatReportPeriod {
  year: number;
  month: number;
}

export interface VatPlatformBreakdown {
  platform: string;
  orderCount: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
}

export interface VatRateBreakdown {
  vatRatePercent: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
}

export interface VatReport {
  period: VatReportPeriod;
  grossSales: number;
  vatAmount: number;
  netSales: number;
  byPlatform: VatPlatformBreakdown[];
  byVatRate: VatRateBreakdown[];
  reportingNote: string;
  defaultVatRatePercent: number;
}

export interface VatInvoiceLineDetail {
  sku: string;
  quantity: number;
  grossAmount: number;
  vatRatePercent: number;
  vatAmount: number;
  netAmount: number;
}

export interface VatInvoiceDetail {
  orderId: string;
  platformOrderId: string;
  platform: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  lines: VatInvoiceLineDetail[];
}

export interface VatDeclarationReport extends VatReport {
  periodKey: string;
  invoiceDetails: VatInvoiceDetail[];
}

export interface ELedgerEntry {
  entryType: 'SALE' | 'RETURN' | 'VAT';
  entryDate: string;
  documentNo: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  vatAmount: number;
}

export interface ELedgerReport {
  periodKey: string;
  format: 'xml' | 'json';
  gibCompliant: false;
  stubNote: string;
  entries: ELedgerEntry[];
  payload?: string;
}

export interface BaBsPartyRow {
  taxId: string | null;
  name: string;
  documentCount: number;
  totalAmount: number;
}

export interface BaBsReport {
  periodKey: string;
  thresholdTry: number;
  salesToCustomers: BaBsPartyRow[];
  purchasesFromSuppliers: BaBsPartyRow[];
  reportingNote: string;
}
