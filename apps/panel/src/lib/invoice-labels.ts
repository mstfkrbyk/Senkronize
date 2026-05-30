import type { InvoiceStatus } from '@/types/invoice';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  PAID: 'Ödendi',
  CANCELLED: 'İptal',
  OVERDUE: 'Vadesi geçmiş',
};

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-sky-100 text-sky-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  OVERDUE: 'bg-amber-100 text-amber-900',
};

export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'DRAFT', label: INVOICE_STATUS_LABELS.DRAFT },
  { value: 'SENT', label: INVOICE_STATUS_LABELS.SENT },
  { value: 'PAID', label: INVOICE_STATUS_LABELS.PAID },
  { value: 'OVERDUE', label: INVOICE_STATUS_LABELS.OVERDUE },
  { value: 'CANCELLED', label: INVOICE_STATUS_LABELS.CANCELLED },
];

export function formatInvoiceDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatInvoiceAmount(amount: string, currency: string): string {
  const n = Number(amount);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}
