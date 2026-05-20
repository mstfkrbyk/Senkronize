import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

import type { PurchaseOrderDetail } from './purchase-order.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTr(date: Date | null | undefined): string {
  if (!date) {
    return '—';
  }
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(date);
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  CONFIRMED: 'Onaylandı',
  PARTIALLY_RECEIVED: 'Kısmen Teslim',
  RECEIVED: 'Teslim Alındı',
  CANCELLED: 'İptal',
};

@Injectable()
export class PurchaseOrderPdfService {
  private readonly logger = new Logger(PurchaseOrderPdfService.name);

  async generatePurchaseOrderPdf(
    organizationName: string,
    po: PurchaseOrderDetail,
  ): Promise<Buffer> {
    const itemRows = po.items
      .map(
        (item, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="mono">${escapeHtml(item.barcode)}</td>
        <td>${escapeHtml(item.productName)}</td>
        <td class="num">${item.orderedQty}</td>
        <td class="num">${item.receivedQty}</td>
        <td class="num">${item.unitCost.toFixed(2)}</td>
        <td class="num">${item.totalCost.toFixed(2)}</td>
      </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Satın Alma Siparişi ${escapeHtml(po.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 20px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0f172a; }
    .subtitle { color: #64748b; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .box h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 8px; }
    .box p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .num { text-align: right; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; }
    .total { text-align: right; font-size: 14px; font-weight: 700; margin-top: 12px; }
    .notes { margin-top: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; }
    .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Satın Alma Siparişi</h1>
  <div class="subtitle">${escapeHtml(po.orderNumber)} · ${STATUS_LABEL[po.status] ?? po.status}</div>

  <div class="grid">
    <div class="box">
      <h2>Alıcı</h2>
      <p><strong>${escapeHtml(organizationName)}</strong></p>
      <p>Oluşturma: ${formatDateTr(po.createdAt)}</p>
      <p>Beklenen: ${formatDateTr(po.expectedDate)}</p>
    </div>
    <div class="box">
      <h2>Tedarikçi</h2>
      <p><strong>${escapeHtml(po.supplier.name)}</strong></p>
      ${po.supplier.email ? `<p>${escapeHtml(po.supplier.email)}</p>` : ''}
      ${po.supplier.phone ? `<p>${escapeHtml(po.supplier.phone)}</p>` : ''}
      ${po.supplier.country ? `<p>${escapeHtml(po.supplier.country)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Barkod</th>
        <th>Ürün</th>
        <th>Sipariş</th>
        <th>Teslim</th>
        <th>Birim (${escapeHtml(po.currency)})</th>
        <th>Toplam</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="total">Genel Toplam: ${po.totalAmount.toFixed(2)} ${escapeHtml(po.currency)}</div>

  ${po.notes ? `<div class="notes"><strong>Not:</strong> ${escapeHtml(po.notes)}</div>` : ''}

  <div class="footer">Senkronize · Satın Alma Siparişi</div>
</body>
</html>`;

    return this.renderHtmlToPdf(html);
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
