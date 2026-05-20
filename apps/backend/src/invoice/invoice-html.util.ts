import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import type { InvoicePdfContext, InvoiceItem } from './invoice.types';

const TEMPLATE_CANDIDATES = [
  join(__dirname, 'templates', 'invoice.html'),
  join(process.cwd(), 'dist/invoice/templates/invoice.html'),
  join(process.cwd(), 'apps/backend/dist/invoice/templates/invoice.html'),
  join(process.cwd(), 'apps/backend/src/invoice/templates/invoice.html'),
];

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (!cachedTemplate) {
    const path = TEMPLATE_CANDIDATES.find((p) => existsSync(p));
    if (!path) {
      throw new Error('invoice.html şablonu bulunamadı');
    }
    cachedTemplate = readFileSync(path, 'utf8');
  }
  return cachedTemplate;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMoneyTr(amount: number | string, currency: string): string {
  const n = Number(typeof amount === 'string' ? amount : amount);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDateTr(iso: Date | string | null): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(d);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  PAID: 'Ödendi',
  CANCELLED: 'İptal',
  OVERDUE: 'Vadesi geçti',
};

function buildSenderBlock(org: InvoicePdfContext['org']): string {
  const lines = [
    escapeHtml(org.name),
    org.taxNumber ? `VKN/TCKN: ${escapeHtml(org.taxNumber)}` : '',
    org.taxOffice ? `Vergi dairesi: ${escapeHtml(org.taxOffice)}` : '',
    org.address ? escapeHtml(org.address) : '',
    org.city ? escapeHtml(org.city) : '',
  ].filter(Boolean);
  return lines.join('<br/>');
}

function buildRecipientDetails(ctx: InvoicePdfContext): string {
  const lines: string[] = [];
  if (ctx.customerTaxId) {
    lines.push(`VKN/TCKN: ${escapeHtml(ctx.customerTaxId)}`);
  }
  if (ctx.customerPhone) {
    lines.push(escapeHtml(ctx.customerPhone));
  }
  if (ctx.customerEmail) {
    lines.push(escapeHtml(ctx.customerEmail));
  }
  if (ctx.customerAddress) {
    lines.push(escapeHtml(ctx.customerAddress));
  }
  return lines.length > 0 ? lines.join('<br/>') : '';
}

function buildItemsRows(items: InvoiceItem[], currency: string): string {
  if (items.length === 0) {
    return '<tr><td colspan="6">Satır bulunmuyor</td></tr>';
  }
  return items
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.name)}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatMoneyTr(it.unitPrice, currency)}</td>
        <td class="num">%${it.taxRate}</td>
        <td class="num">${formatMoneyTr(it.taxAmount, currency)}</td>
        <td class="num">${formatMoneyTr(it.total, currency)}</td>
      </tr>`,
    )
    .join('');
}

export function renderInvoiceHtml(ctx: InvoicePdfContext): string {
  const template = loadTemplate();
  const paymentNote =
    ctx.notes?.trim() ||
    'Ödeme, fatura vadesinde banka havalesi veya anlaşmalı ödeme yöntemi ile yapılacaktır.';

  return template
    .replace(/\{\{invoiceNumber\}\}/g, escapeHtml(ctx.invoiceNumber))
    .replace(/\{\{invoiceDate\}\}/g, escapeHtml(ctx.invoiceDate))
    .replace(/\{\{dueDate\}\}/g, escapeHtml(ctx.dueDate ?? '—'))
    .replace(/\{\{statusLabel\}\}/g, escapeHtml(STATUS_LABELS[ctx.status] ?? ctx.status))
    .replace(
      /\{\{eArchiveBadge\}\}/g,
      ctx.isEArchive
        ? '<span class="badge-earchive">e-Arşiv hazırlık</span>'
        : '',
    )
    .replace(/\{\{senderBlock\}\}/g, buildSenderBlock(ctx.org))
    .replace(/\{\{customerName\}\}/g, escapeHtml(ctx.customerName))
    .replace(/\{\{recipientDetails\}\}/g, buildRecipientDetails(ctx))
    .replace(/\{\{itemsRows\}\}/g, buildItemsRows(ctx.items, ctx.currency))
    .replace(/\{\{subtotal\}\}/g, formatMoneyTr(ctx.subtotal, ctx.currency))
    .replace(/\{\{taxRate\}\}/g, String(ctx.taxRate))
    .replace(/\{\{taxAmount\}\}/g, formatMoneyTr(ctx.taxAmount, ctx.currency))
    .replace(/\{\{totalAmount\}\}/g, formatMoneyTr(ctx.totalAmount, ctx.currency))
    .replace(/\{\{paymentNote\}\}/g, escapeHtml(paymentNote));
}
