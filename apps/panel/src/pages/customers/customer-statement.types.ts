export type CustomerStatementLineType = 'INVOICE' | 'PAYMENT';

export interface CustomerStatementLine {
  id: string;
  type: CustomerStatementLineType;
  date: string;
  /** Tahsilat satırında ödeme tarihi; yoksa `date` kullanılır */
  paidAt: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CustomerStatementDto {
  totalDebit: number;
  totalCredit: number;
  balance: number;
  lines: CustomerStatementLine[];
}

export interface CustomerStatementView extends CustomerStatementDto {
  unavailable: boolean;
}

export interface CustomerStatementApiEntry {
  id: string;
  date: string;
  type: CustomerStatementLineType;
  description: string;
  debit: string;
  credit: string;
  referenceId: string;
  referenceType: 'invoice';
  status: string;
}

export interface CustomerStatementApiBalance {
  receivable: string;
  collected: string;
  netBalance: string;
  currency: string;
}

export interface CustomerStatementApi {
  customerId: string;
  customerName: string;
  balance: CustomerStatementApiBalance;
  entries: CustomerStatementApiEntry[];
  invoices: Array<{ id: string; paidAt: string | null }>;
}
