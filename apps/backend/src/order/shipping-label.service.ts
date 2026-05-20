import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CargoProvider } from '@prisma/client';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { PassThrough } from 'stream';

import { createCargoAdapter } from '../adapters/cargo/cargo-adapter.factory';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

export interface LabelData {
  recipientName: string;
  recipientAddress: string | null;
  recipientCity: string | null;
  recipientPhone: string | null;
  barcode: string;
  orderNumber: string;
  senderName: string;
  cargoProvider: string | null;
  date: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLabelFileName(orderNumber: string): string {
  return `Etiket-${orderNumber.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
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

function parseCargoProvider(raw: string | null): CargoProvider | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const values = Object.values(CargoProvider) as string[];
  if (values.includes(key)) {
    return key as CargoProvider;
  }
  return null;
}

@Injectable()
export class ShippingLabelService {
  private readonly logger = new Logger(ShippingLabelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async generateLabel(orderId: string, orgId: string): Promise<Buffer> {
    const order = await this.loadOrder(orderId, orgId);
    const providerLabel = await this.fetchProviderLabel(order, orgId);
    if (providerLabel) {
      return providerLabel;
    }
    return this.renderHtmlToPdf(this.buildLabelHtmlFromOrder(order));
  }

  async generateBulkLabels(orderIds: string[], orgId: string): Promise<Buffer> {
    return this.buildLabelsZip(orderIds, orgId);
  }

  private async loadOrder(
    orderId: string,
    orgId: string,
  ): Promise<{
    id: string;
    customerName: string;
    shippingAddress: string | null;
    customerPhone: string | null;
    cargoTrackingNumber: string | null;
    cargoProvider: string | null;
    platformOrderId: string;
    organization: { name: string };
  }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId, deletedAt: null },
      include: { organization: { select: { name: true } } },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    return order;
  }

  private buildLabelHtmlFromOrder(order: {
    customerName: string;
    shippingAddress: string | null;
    customerPhone: string | null;
    cargoTrackingNumber: string | null;
    cargoProvider: string | null;
    platformOrderId: string;
    organization: { name: string };
  }): string {
    return this.buildLabelHtml({
      recipientName: order.customerName,
      recipientAddress: order.shippingAddress,
      recipientCity: null,
      recipientPhone: order.customerPhone,
      barcode: order.cargoTrackingNumber ?? order.platformOrderId,
      orderNumber: order.platformOrderId,
      senderName: order.organization.name,
      cargoProvider: order.cargoProvider,
      date: new Date().toLocaleDateString('tr-TR'),
    });
  }

  private async buildLabelsZip(orderIds: string[], orgId: string): Promise<Buffer> {
    const uniqueIds = [...new Set(orderIds)];
    const files: { name: string; buffer: Buffer }[] = [];

    for (const id of uniqueIds) {
      const order = await this.prisma.order.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        include: { organization: { select: { name: true } } },
      });
      if (!order) {
        continue;
      }

      const providerLabel = await this.fetchProviderLabel(order, orgId);
      const buffer =
        providerLabel ?? (await this.renderHtmlToPdf(this.buildLabelHtmlFromOrder(order)));

      files.push({
        name: safeLabelFileName(order.platformOrderId),
        buffer,
      });
    }

    if (files.length === 0) {
      throw new NotFoundException('Etiket oluşturulacak sipariş bulunamadı');
    }

    return await zipPdfBuffers(files);
  }

  private async fetchProviderLabel(
    order: {
      cargoProvider: string | null;
      cargoTrackingNumber: string | null;
    },
    orgId: string,
  ): Promise<Buffer | null> {
    const provider = parseCargoProvider(order.cargoProvider);
    const tracking = order.cargoTrackingNumber?.trim();
    if (!provider || !tracking) {
      return null;
    }

    const connection = await this.prisma.cargoConnection.findUnique({
      where: {
        organizationId_provider: { organizationId: orgId, provider },
      },
    });
    if (!connection?.isActive || !connection.credentialsEnc) {
      return null;
    }

    try {
      const creds = this.parseCredentials(connection.credentialsEnc);
      if (Object.keys(creds).length === 0) {
        return null;
      }
      const adapter = createCargoAdapter(provider, creds);
      return await adapter.getLabel(tracking);
    } catch (error) {
      this.logger.warn('Kargo firması etiketi alınamadı', {
        provider,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private parseCredentials(enc: string): Record<string, unknown> {
    try {
      const plain = this.encryption.decrypt(enc);
      const parsed: unknown = JSON.parse(plain);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }

  private buildLabelHtml(data: LabelData): string {
    const barcodeValue = escapeHtml(data.barcode);
    const addressLine = [data.recipientAddress, data.recipientCity]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map(escapeHtml)
      .join(', ');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Kargo Etiketi ${escapeHtml(data.orderNumber)}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      width: 100mm;
      height: 150mm;
      padding: 6mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4mm;
      margin-bottom: 4mm;
    }
    .sender { font-size: 9px; color: #475569; max-width: 45%; }
    .sender strong { display: block; font-size: 10px; color: #0f172a; margin-bottom: 2px; }
    .cargo {
      text-align: right;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .section-title {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2mm;
    }
    .recipient {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4mm;
      margin-bottom: 4mm;
    }
    .recipient-name {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 2mm;
    }
    .recipient-detail { font-size: 10px; line-height: 1.4; color: #334155; }
    .barcode-wrap {
      text-align: center;
      margin-top: auto;
      padding-top: 3mm;
      border-top: 1px dashed #94a3b8;
    }
    svg#barcode { width: 100%; max-height: 22mm; }
    .order-no {
      font-family: ui-monospace, monospace;
      font-size: 13px;
      font-weight: 700;
      margin-top: 2mm;
      letter-spacing: 0.04em;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
      margin-top: 2mm;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">
      <strong>Gönderici</strong>
      ${escapeHtml(data.senderName)}
    </div>
    <div class="cargo">${data.cargoProvider ? escapeHtml(data.cargoProvider) : 'KARGO'}</div>
  </div>

  <div class="recipient">
    <div class="section-title">Alıcı</div>
    <div class="recipient-name">${escapeHtml(data.recipientName)}</div>
    ${addressLine ? `<div class="recipient-detail">${addressLine}</div>` : ''}
    ${data.recipientPhone ? `<div class="recipient-detail">Tel: ${escapeHtml(data.recipientPhone)}</div>` : ''}
  </div>

  <div class="barcode-wrap">
    <svg id="barcode"></svg>
    <div class="order-no">${escapeHtml(data.orderNumber)}</div>
    <div class="footer">
      <span>Senkronize</span>
      <span>${escapeHtml(data.date)}</span>
    </div>
  </div>

  <script>
    JsBarcode("#barcode", ${JSON.stringify(data.barcode)}, {
      format: "CODE128",
      width: 2,
      height: 64,
      displayValue: true,
      fontSize: 12,
      margin: 4,
    });
  </script>
</body>
</html>`;
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        width: '100mm',
        height: '150mm',
        printBackground: true,
        margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
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
