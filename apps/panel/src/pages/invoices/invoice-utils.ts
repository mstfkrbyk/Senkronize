import { addDays, format } from 'date-fns';

import type { InvoiceStatus } from '@/types/invoice';

import { parseJsonBlobMessage } from '@/lib/api';

import { invoicesT } from './translations';

export class InvoicePdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoicePdfError';
  }
}

const INVOICE_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Manuel fatura oluşturma diyaloğu için varsayılan vade (+7 gün, yerel tarih). */
export function defaultManualInvoiceDueDate(): string {
  return format(addDays(new Date(), 7), 'yyyy-MM-dd');
}

/** yyyy-MM-dd — yerel takvim günü; geçersiz gün/ay için null. */
export function parseInvoiceDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!INVOICE_DATE_ONLY_RE.test(trimmed)) {
    return null;
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Manuel fatura vade alanı — hata metni veya geçerliyse null. */
export function validateManualInvoiceDueDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return invoicesT('create.dueDateRequired');
  }
  if (parseInvoiceDateOnly(trimmed) === null) {
    return invoicesT('create.dueDateInvalid');
  }
  return null;
}

export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  'DRAFT',
  'SENT',
  'PAID',
  'OVERDUE',
  'CANCELLED',
].map((value) => ({
  value: value as InvoiceStatus,
  label: invoicesT(`status.${value}`),
}));

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: 'border-transparent bg-muted text-muted-foreground',
  SENT: 'border-transparent bg-sky-500/15 text-sky-800 dark:text-sky-300',
  PAID: 'border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  CANCELLED: 'border-transparent bg-destructive/15 text-destructive dark:text-red-300',
  OVERDUE:
    'border-amber-500/40 bg-amber-500/20 font-semibold text-amber-950 dark:text-amber-100',
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return invoicesT(`status.${status}`);
}

export function isInvoiceIssueEligible(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function isInvoiceMarkPaidEligible(status: InvoiceStatus): boolean {
  return status === 'SENT' || status === 'OVERDUE';
}

/** Vade alanı (yyyy-MM-dd veya ISO) — yerel takvim günü olarak gösterilir. */
export function formatInvoiceDueDate(iso: string): string {
  const dateOnly = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split('-').map(Number);
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(
      new Date(y, m - 1, d),
    );
  }
  return formatInvoiceDate(iso);
}

export function accountingPaymentMethodLabel(method: string): string {
  const key = `paymentMethod.${method}`;
  const label = invoicesT(key);
  return label === key ? invoicesT('paymentMethod.OTHER') : label;
}

export function formatInvoiceDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatInvoiceDateTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatInvoiceAmount(amount: string, currency: string): string {
  const n = Number(amount);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}

export function invoicePdfFileName(invoiceNumber: string): string {
  return `fatura-${invoiceNumber.replace(/\//g, '-')}.pdf`;
}

export async function fetchInvoicePdfBlob(
  id: string,
  apiGet: (
    url: string,
    config?: { responseType: 'blob' },
  ) => Promise<{ data: BlobPart }>,
): Promise<Blob> {
  const res = await apiGet(`/invoices/${id}/pdf`, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });

  if (blob.size === 0) {
    throw new InvoicePdfError(invoicesT('detail.pdfPreviewEmpty'));
  }

  const header = await blob.slice(0, 4).text();
  if (!header.startsWith('%PDF')) {
    const apiMsg = await parseJsonBlobMessage(blob);
    throw new InvoicePdfError(apiMsg ?? invoicesT('detail.pdfPreviewError'));
  }

  return blob;
}

export function downloadInvoicePdfBlob(blob: Blob, invoiceNumber: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = invoicePdfFileName(invoiceNumber);
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoicePdf(
  id: string,
  invoiceNumber: string,
  apiGet: (
    url: string,
    config?: { responseType: 'blob' },
  ) => Promise<{ data: BlobPart }>,
): Promise<void> {
  const blob = await fetchInvoicePdfBlob(id, apiGet);
  downloadInvoicePdfBlob(blob, invoiceNumber);
}

export const ERP_INVOICE_TYPES = ['PARASUT', 'BIZIMHESAP'] as const;
export type ErpInvoiceType = (typeof ERP_INVOICE_TYPES)[number];

export function erpTypeLabel(erpType: string): string {
  if (erpType === 'PARASUT') {
    return invoicesT('erp.parasut');
  }
  if (erpType === 'BIZIMHESAP') {
    return invoicesT('erp.bizimhesap');
  }
  return invoicesT('erp.other');
}
