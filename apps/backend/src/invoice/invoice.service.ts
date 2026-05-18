import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Order, OrderItem, Organization } from '@prisma/client';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { PassThrough } from 'stream';

import { PrismaService } from '../prisma/prisma.service';

export type OrderForInvoice = Order & { items: OrderItem[] };

export type OrganizationForInvoice = Pick<
  Organization,
  'name' | 'taxNumber' | 'taxOffice' | 'address' | 'city'
>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: string | { toString(): string }, currency: string): string {
  const n = Number(typeof amount === 'string' ? amount : amount.toString());
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateTr(iso: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(iso);
}

function safePdfFileName(order: Order): string {
  const slug = `${order.platform}-${order.platformOrderId}`.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `Fatura-${slug}.pdf`;
}

async function zipPdfBuffers(files: { name: string; buffer: Buffer }[]): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    passthrough.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    passthrough.on('error', reject);
    archive.on('error', reject);
    archive.pipe(passthrough);
    for (const f of files) {
      archive.append(f.buffer, { name: f.name });
    }
    void archive.finalize();
  });
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  generateInvoiceHtml(order: OrderForInvoice, org: OrganizationForInvoice): string {
    const invoiceNo = `FTR-${order.id.slice(-10).toUpperCase()}`;
    const rowsHtml = order.items
      .map(
        (it) => `
      <tr>
        <td>${escapeHtml(it.productName?.trim() || it.sku)}</td>
        <td>${escapeHtml(it.barcode)}</td>
        <td>${escapeHtml(it.sku)}</td>
        <td style="text-align:right">${it.quantity}</td>
        <td style="text-align:right">${formatMoney(it.unitPrice, order.currency)}</td>
        <td style="text-align:right">${formatMoney(
          Number(it.unitPrice.toString()) * it.quantity,
          order.currency,
        )}</td>
      </tr>`,
      )
      .join('');

    const orgLines = [
      escapeHtml(org.name),
      org.taxNumber ? `VKN/TCKN: ${escapeHtml(org.taxNumber)}` : '',
      org.taxOffice ? `Vergi dairesi: ${escapeHtml(org.taxOffice)}` : '',
      org.address ? escapeHtml(org.address) : '',
      org.city ? escapeHtml(org.city) : '',
    ]
      .filter(Boolean)
      .join('<br/>');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Fatura ${escapeHtml(invoiceNo)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #111827; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .logo { font-size: 22px; font-weight: 700; color: #0ea5e9; }
    .invoice-title { font-size: 18px; color: #374151; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th { background: #f3f4f6; padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .total-row td { font-weight: 700; background: #f9fafb; }
    .meta { font-size: 13px; color: #4b5563; line-height: 1.5; }
    .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Senkronize</div>
      <div class="invoice-title">Satış Faturası</div>
      <p class="meta" style="margin-top:12px">${orgLines}</p>
    </div>
    <div class="meta" style="text-align:right">
      <div><strong>Fatura no:</strong> ${escapeHtml(invoiceNo)}</div>
      <div><strong>Tarih:</strong> ${escapeHtml(formatDateTr(order.platformCreatedAt))}</div>
      <div><strong>Platform:</strong> ${escapeHtml(order.platform)}</div>
      <div><strong>Pazaryeri sipariş:</strong> ${escapeHtml(order.platformOrderId)}</div>
      <div><strong>Durum:</strong> ${escapeHtml(order.status)}</div>
    </div>
  </div>

  <p class="meta"><strong>Alıcı:</strong> ${escapeHtml(order.customerName)}</p>
  ${
    order.shippingAddress
      ? `<p class="meta"><strong>Teslimat:</strong> ${escapeHtml(order.shippingAddress)}</p>`
      : ''
  }

  <table>
    <thead>
      <tr>
        <th>Ürün</th>
        <th>Barkod</th>
        <th>SKU</th>
        <th style="text-align:right">Adet</th>
        <th style="text-align:right">Birim fiyat</th>
        <th style="text-align:right">Tutar</th>
      </tr>
    </thead>
    <tbody>
      ${
        order.items.length > 0
          ? rowsHtml
          : `<tr><td colspan="6">Satır bulunmuyor</td></tr>`
      }
      <tr class="total-row">
        <td colspan="5" style="text-align:right">Genel toplam</td>
        <td style="text-align:right">${formatMoney(order.totalAmount, order.currency)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Bu belge Senkronize panelinden üretilmiştir. Yasal e-fatura/e-arşiv yerine geçmez.
  </div>
</body>
</html>`;
  }

  async generateInvoicePdf(orderId: string, organizationId: string): Promise<Buffer> {
    const { order, org } = await this.loadOrderWithOrg(organizationId, orderId);
    const html = this.generateInvoiceHtml(order, org);
    return await this.renderHtmlToPdf(html);
  }

  async generateBulkInvoicePdf(
    orderIds: string[],
    organizationId: string,
  ): Promise<Buffer> {
    const uniqueIds = [...new Set(orderIds)];
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      const files: { name: string; buffer: Buffer }[] = [];
      for (const id of uniqueIds) {
        const { order, org } = await this.loadOrderWithOrg(organizationId, id);
        const html = this.generateInvoiceHtml(order, org);
        await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
        });
        files.push({
          name: safePdfFileName(order),
          buffer: Buffer.from(pdf),
        });
      }
      return await zipPdfBuffers(files);
    } finally {
      await browser.close().catch((err: unknown) => {
        this.logger.warn('Tarayıcı kapatılamadı', { error: err });
      });
    }
  }

  private async loadOrderWithOrg(
    organizationId: string,
    orderId: string,
  ): Promise<{ order: OrderForInvoice; org: OrganizationForInvoice }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { name: true, taxNumber: true, taxOffice: true, address: true, city: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı');
    }
    return { order, org };
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch((err: unknown) => {
        this.logger.warn('Tarayıcı kapatılamadı', { error: err });
      });
    }
  }

  private async launchBrowser(): Promise<ReturnType<typeof puppeteer.launch>> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(executablePath ? { executablePath } : {}),
    });
  }
}
