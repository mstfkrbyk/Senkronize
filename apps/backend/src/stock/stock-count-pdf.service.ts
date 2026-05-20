import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

export interface CountSheetRow {
  barcode: string;
  productName: string;
  systemQuantity: number;
}

export interface CountSheetMeta {
  sessionId: string;
  warehouseName: string;
  warehouseCode: string;
  countMode: string;
  startedAt: string;
}

@Injectable()
export class StockCountPdfService {
  private readonly logger = new Logger(StockCountPdfService.name);

  async generateCountSheetPdf(
    meta: CountSheetMeta,
    rows: CountSheetRow[],
  ): Promise<Buffer> {
    const qrMap = new Map<string, string>();
    for (const row of rows) {
      if (!qrMap.has(row.barcode)) {
        const dataUrl = await QRCode.toDataURL(row.barcode, {
          width: 120,
          margin: 1,
        });
        qrMap.set(row.barcode, dataUrl);
      }
    }

    const tableRows = rows
      .map(
        (row, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="mono">${escapeHtml(row.barcode)}</td>
        <td>${escapeHtml(row.productName)}</td>
        <td class="num">${row.systemQuantity}</td>
        <td class="count-cell"></td>
        <td class="qr"><img src="${qrMap.get(row.barcode) ?? ''}" alt="" /></td>
      </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Stok Sayım Formu</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; margin-bottom: 16px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: middle; }
    th { background: #f1f5f9; font-weight: 600; }
    .num { text-align: right; width: 36px; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; }
    .count-cell { width: 72px; min-height: 28px; }
    .qr img { width: 56px; height: 56px; display: block; }
    .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>Stok Sayım Formu</h1>
  <div class="meta">
    Depo: ${escapeHtml(meta.warehouseName)} (${escapeHtml(meta.warehouseCode)}) ·
    Mod: ${escapeHtml(meta.countMode)} ·
    Oturum: ${escapeHtml(meta.sessionId.slice(0, 12))}… ·
    Tarih: ${escapeHtml(meta.startedAt)}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Barkod</th>
        <th>Ürün</th>
        <th>Beklenen</th>
        <th>Sayılan</th>
        <th>QR</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows.length > 0 ? tableRows : '<tr><td colspan="6" style="text-align:center;padding:24px;">Sayım kalemi yok</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Senkronize stok sayım formu — sayılan miktarı elle doldurun veya CSV ile yükleyin.</div>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
