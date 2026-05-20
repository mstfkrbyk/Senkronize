export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'CANCELLED'
  | 'OVERDUE';

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
}
