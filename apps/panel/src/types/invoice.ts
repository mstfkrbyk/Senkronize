export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'CANCELLED'
  | 'OVERDUE';

export const ACCOUNTING_PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'CARD',
  'CHECK',
  'OTHER',
] as const;

export type AccountingPaymentMethod = (typeof ACCOUNTING_PAYMENT_METHODS)[number];

export interface InvoiceItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceDto {
  id: string;
  organizationId: string;
  orderId: string | null;
  invoiceNumber: string;
  invoiceYear: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  items: InvoiceItemDto[];
  subtotal: string;
  taxAmount: string;
  taxRate: number;
  totalAmount: string;
  currency: string;
  status: InvoiceStatus;
  paidAt: string | null;
  paymentMethod: AccountingPaymentMethod | string | null;
  isEArchive: boolean;
  pdfUrl: string | null;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceStatsDto {
  totalCount: number;
  monthRevenue: string;
  monthCount: number;
  overdueCount: number;
}

/** GET /invoices — arama/tarih filtreleriyle uyumlu durum sayıları (status filtresi hariç) */
export type InvoiceListMeta = {
  DRAFT: number;
  SENT: number;
  PAID: number;
  OVERDUE: number;
};

export type InvoiceListResponse = {
  items: InvoiceDto[];
  total: number;
  page?: number;
  limit?: number;
  meta: InvoiceListMeta;
};
