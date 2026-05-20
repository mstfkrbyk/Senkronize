import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  Prisma,
  type Invoice,
  type Order,
  type OrderItem,
} from '@prisma/client';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { PassThrough } from 'stream';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateInvoiceDto, InvoiceQueryDto } from './invoice.dto';
import { formatDateTr, renderInvoiceHtml } from './invoice-html.util';
import type {
  InvoiceItem,
  InvoicePdfContext,
  InvoiceStats,
  OrganizationForInvoicePdf,
  SerializedInvoice,
} from './invoice.types';

export type OrderForInvoice = Order & { items: OrderItem[] };

const DEFAULT_TAX_RATE = 20;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseItemsJson(raw: Prisma.JsonValue): InvoiceItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: InvoiceItem[] = [];
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const r = row as Record<string, unknown>;
    if (
      typeof r.name !== 'string' ||
      typeof r.quantity !== 'number' ||
      typeof r.unitPrice !== 'number'
    ) {
      continue;
    }
    items.push({
      name: r.name,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      taxRate: typeof r.taxRate === 'number' ? r.taxRate : DEFAULT_TAX_RATE,
      taxAmount: typeof r.taxAmount === 'number' ? r.taxAmount : 0,
      total: typeof r.total === 'number' ? r.total : 0,
    });
  }
  return items;
}

function buildLineItems(
  rows: { name: string; quantity: number; unitPrice: number; taxRate?: number }[],
  defaultTaxRate: number,
): { items: InvoiceItem[]; subtotal: number; taxAmount: number; totalAmount: number } {
  let subtotal = 0;
  let taxAmount = 0;
  const items: InvoiceItem[] = rows.map((row) => {
    const rate = row.taxRate ?? defaultTaxRate;
    const lineSubtotal = roundMoney(row.quantity * row.unitPrice);
    const lineTax = roundMoney((lineSubtotal * rate) / 100);
    const lineTotal = roundMoney(lineSubtotal + lineTax);
    subtotal += lineSubtotal;
    taxAmount += lineTax;
    return {
      name: row.name,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      taxRate: rate,
      taxAmount: lineTax,
      total: lineTotal,
    };
  });
  return {
    items,
    subtotal: roundMoney(subtotal),
    taxAmount: roundMoney(taxAmount),
    totalAmount: roundMoney(subtotal + taxAmount),
  };
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

function safePdfFileName(invoiceNumber: string): string {
  const slug = invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `Fatura-${slug}.pdf`;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateInvoiceNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { organizationId, invoiceYear: year, deletedAt: null },
    });
    return `${year}/${String(count + 1).padStart(6, '0')}`;
  }

  async generateSnkInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SNK-${year}-`;
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
        deletedAt: null,
      },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async createFromSubscriptionPayment(
    organizationId: string,
    params: {
      planName: string;
      amountTry: number;
      periodStart: Date;
      periodEnd: Date;
      customerName: string;
      customerEmail?: string;
      customerAddress?: string;
      customerTaxId?: string;
      paymentId?: string;
    },
  ): Promise<SerializedInvoice> {
    const amountExclVat = roundMoney(params.amountTry / 1.2);
    const taxAmount = roundMoney(params.amountTry - amountExclVat);
    const invoiceNumber = await this.generateSnkInvoiceNumber();
    const year = new Date().getFullYear();

    const row = await this.prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        invoiceYear: year,
        customerName: params.customerName,
        customerEmail: params.customerEmail ?? null,
        customerAddress: params.customerAddress ?? null,
        customerTaxId: params.customerTaxId ?? null,
        items: [
          {
            name: params.planName,
            quantity: 1,
            unitPrice: amountExclVat,
            taxRate: DEFAULT_TAX_RATE,
            taxAmount,
            total: params.amountTry,
          },
        ] as unknown as Prisma.InputJsonValue,
        subtotal: new Prisma.Decimal(amountExclVat),
        taxAmount: new Prisma.Decimal(taxAmount),
        taxRate: DEFAULT_TAX_RATE,
        totalAmount: new Prisma.Decimal(params.amountTry),
        currency: 'TRY',
        status: InvoiceStatus.PAID,
        notes: params.paymentId
          ? `Abonelik ödemesi — Iyzico: ${params.paymentId}`
          : 'Abonelik ödemesi',
        dueDate: params.periodEnd,
      },
    });

    return this.serializeInvoice(row);
  }

  async create(
    organizationId: string,
    dto: CreateInvoiceDto,
  ): Promise<SerializedInvoice> {
    const { items, subtotal, taxAmount, totalAmount } = buildLineItems(
      dto.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
      })),
      dto.taxRate ?? DEFAULT_TAX_RATE,
    );

    const invoiceNumber = await this.generateInvoiceNumber(organizationId);
    const year = new Date().getFullYear();

    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, organizationId, deletedAt: null },
      });
      if (!order) {
        throw new NotFoundException('Sipariş bulunamadı');
      }
    }

    const row = await this.prisma.invoice.create({
      data: {
        organizationId,
        orderId: dto.orderId ?? null,
        invoiceNumber,
        invoiceYear: year,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerAddress: dto.customerAddress ?? null,
        customerTaxId: dto.customerTaxId ?? null,
        items: items as unknown as Prisma.InputJsonValue,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        taxRate: dto.taxRate ?? DEFAULT_TAX_RATE,
        totalAmount: new Prisma.Decimal(totalAmount),
        currency: dto.currency ?? 'TRY',
        notes: dto.notes ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        isEArchive: dto.isEArchive ?? false,
      },
    });

    return this.serializeInvoice(row);
  }

  async createFromOrder(
    organizationId: string,
    orderId: string,
  ): Promise<SerializedInvoice> {
    const existing = await this.prisma.invoice.findFirst({
      where: { organizationId, orderId, deletedAt: null },
    });
    if (existing) {
      return this.serializeInvoice(existing);
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    return this.create(organizationId, {
      customerName: order.customerName,
      customerPhone: order.customerPhone ?? undefined,
      customerAddress: order.shippingAddress ?? undefined,
      orderId: order.id,
      currency: order.currency,
      dueDate: dueDate.toISOString(),
      notes: `Pazaryeri siparişi: ${order.platform} — ${order.platformOrderId}`,
      items: order.items.map((it) => ({
        name: it.productName?.trim() || it.sku,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice.toString()),
      })),
    });
  }

  async findAll(
    organizationId: string,
    query: InvoiceQueryDto,
  ): Promise<{ items: SerializedInvoice[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      createdAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
      ...(query.search && {
        OR: [
          {
            customerName: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { invoiceNumber: { contains: query.search } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.serializeInvoice(r)),
      total,
      page,
      limit,
    };
  }

  async findOne(organizationId: string, id: string): Promise<SerializedInvoice> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    return this.serializeInvoice(row);
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: InvoiceStatus,
  ): Promise<SerializedInvoice> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status },
    });
    return this.serializeInvoice(updated);
  }

  async getStats(organizationId: string): Promise<InvoiceStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const baseWhere: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
    };

    const [totalCount, monthAgg, monthCount] = await Promise.all([
      this.prisma.invoice.count({ where: baseWhere }),
      this.prisma.invoice.aggregate({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfMonth },
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.SENT] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({
        where: { ...baseWhere, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      totalCount,
      monthRevenue: monthAgg._sum.totalAmount?.toString() ?? '0',
      monthCount,
    };
  }

  async generateInvoicePdfBuffer(
    organizationId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null },
    });
    if (!invoice) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    const org = await this.loadOrg(organizationId);
    const html = renderInvoiceHtml(this.toPdfContext(invoice, org));
    const buffer = await this.renderHtmlToPdf(html);
    return { buffer, fileName: safePdfFileName(invoice.invoiceNumber) };
  }

  /** Geriye dönük: siparişten anlık PDF (kayıtlı fatura yoksa oluşturur). */
  async generateInvoicePdf(orderId: string, organizationId: string): Promise<Buffer> {
    let invoice = await this.prisma.invoice.findFirst({
      where: { organizationId, orderId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!invoice) {
      await this.createFromOrder(organizationId, orderId);
      invoice = await this.prisma.invoice.findFirst({
        where: { organizationId, orderId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!invoice) {
      throw new NotFoundException('Fatura oluşturulamadı');
    }
    const { buffer } = await this.generateInvoicePdfBuffer(organizationId, invoice.id);
    return buffer;
  }

  async generateBulkInvoicePdf(
    orderIds: string[],
    organizationId: string,
  ): Promise<Buffer> {
    const uniqueIds = [...new Set(orderIds)];
    const files: { name: string; buffer: Buffer }[] = [];
    for (const id of uniqueIds) {
      const buffer = await this.generateInvoicePdf(id, organizationId);
      const invoice = await this.prisma.invoice.findFirst({
        where: { organizationId, orderId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });
      files.push({
        name: safePdfFileName(invoice?.invoiceNumber ?? id),
        buffer,
      });
    }
    return await zipPdfBuffers(files);
  }

  private toPdfContext(
    invoice: Invoice,
    org: OrganizationForInvoicePdf,
  ): InvoicePdfContext {
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatDateTr(invoice.createdAt),
      dueDate: invoice.dueDate ? formatDateTr(invoice.dueDate) : null,
      status: invoice.status,
      isEArchive: invoice.isEArchive,
      org,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      customerTaxId: invoice.customerTaxId,
      items: parseItemsJson(invoice.items),
      subtotal: invoice.subtotal.toString(),
      taxAmount: invoice.taxAmount.toString(),
      taxRate: invoice.taxRate,
      totalAmount: invoice.totalAmount.toString(),
      currency: invoice.currency,
      notes: invoice.notes,
    };
  }

  private async loadOrg(organizationId: string): Promise<OrganizationForInvoicePdf> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { name: true, taxNumber: true, taxOffice: true, address: true, city: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı');
    }
    return org;
  }

  private serializeInvoice(row: Invoice): SerializedInvoice {
    return {
      id: row.id,
      organizationId: row.organizationId,
      orderId: row.orderId,
      invoiceNumber: row.invoiceNumber,
      invoiceYear: row.invoiceYear,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      customerAddress: row.customerAddress,
      customerTaxId: row.customerTaxId,
      items: parseItemsJson(row.items),
      subtotal: row.subtotal.toString(),
      taxAmount: row.taxAmount.toString(),
      taxRate: row.taxRate,
      totalAmount: row.totalAmount.toString(),
      currency: row.currency,
      status: row.status,
      isEArchive: row.isEArchive,
      pdfUrl: row.pdfUrl,
      notes: row.notes,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
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
