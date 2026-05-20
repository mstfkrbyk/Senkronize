import type { InvoiceStatus } from '@prisma/client';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export type SerializedInvoice = {
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
  items: InvoiceItem[];
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
};

export type InvoiceStats = {
  totalCount: number;
  monthRevenue: string;
  monthCount: number;
};

export type OrganizationForInvoicePdf = {
  name: string;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
};

export type InvoicePdfContext = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  isEArchive: boolean;
  org: OrganizationForInvoicePdf;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  items: InvoiceItem[];
  subtotal: string;
  taxAmount: string;
  taxRate: number;
  totalAmount: string;
  currency: string;
  notes: string | null;
};
