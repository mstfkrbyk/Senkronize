import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import type { ErpInvoiceLine } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { CreateInvoiceDto } from '../invoice/invoice.dto';
import { InvoiceService } from '../invoice/invoice.service';
import type { SerializedInvoice } from '../invoice/invoice.types';
import { PrismaService } from '../prisma/prisma.service';

import {
  buildTrailingMonthKeys,
  parseMonthPeriod,
} from '../reports/period-parse.util';

import type {
  CreateAccountingInvoiceDto,
  MarkPaidAccountingInvoiceDto,
} from './accounting.dto';
import type {
  AccountingBulkResult,
  AccountingOverview,
  AccountingRevenueTrend,
  AccountingVatSummary,
  PushToErpResult,
} from './accounting.types';
import { toAccountingStatus } from './accounting.types';

const OPEN_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class AccountingInvoiceService {
  private readonly logger = new Logger(AccountingInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly encryptionService: EncryptionService,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  async getOverview(organizationId: string): Promise<AccountingOverview> {
    const baseWhere: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
    };

    const [openAgg, openCount, paidAgg, paidCount, vatAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, status: { in: OPEN_STATUSES } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({
        where: { ...baseWhere, status: { in: OPEN_STATUSES } },
      }),
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, status: InvoiceStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({
        where: { ...baseWhere, status: InvoiceStatus.PAID },
      }),
      this.prisma.invoice.aggregate({
        where: baseWhere,
        _sum: {
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
        },
      }),
    ]);

    return {
      openInvoiceCount: openCount,
      openInvoiceTotal: openAgg._sum.totalAmount?.toString() ?? '0',
      collectedTotal: paidAgg._sum.totalAmount?.toString() ?? '0',
      collectedCount: paidCount,
      vatSummary: {
        subtotal: vatAgg._sum.subtotal?.toString() ?? '0',
        taxAmount: vatAgg._sum.taxAmount?.toString() ?? '0',
        totalAmount: vatAgg._sum.totalAmount?.toString() ?? '0',
      },
      currency: 'TRY',
    };
  }

  async getVatSummary(
    organizationId: string,
    month: string,
  ): Promise<AccountingVatSummary> {
    const { year, month: monthNum, start, end } = parseMonthPeriod(month);
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
      createdAt: { gte: start, lte: end },
    };

    const [vatAgg, invoiceCount] = await Promise.all([
      this.prisma.invoice.aggregate({
        where,
        _sum: {
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      month: monthKey,
      invoiceCount,
      subtotal: vatAgg._sum.subtotal?.toString() ?? '0',
      taxAmount: vatAgg._sum.taxAmount?.toString() ?? '0',
      totalAmount: vatAgg._sum.totalAmount?.toString() ?? '0',
      currency: 'TRY',
    };
  }

  async getRevenueTrend(
    organizationId: string,
    monthsInput?: number,
  ): Promise<AccountingRevenueTrend> {
    const months = Math.min(Math.max(monthsInput ?? 6, 1), 24);
    const monthKeys = buildTrailingMonthKeys(months);
    const baseWhere = {
      organizationId,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
    } satisfies Prisma.InvoiceWhereInput;

    const points = await Promise.all(
      monthKeys.map(async (month) => {
        const { start, end } = parseMonthPeriod(month);
        const where: Prisma.InvoiceWhereInput = {
          ...baseWhere,
          createdAt: { gte: start, lte: end },
        };
        const [agg, invoiceCount] = await Promise.all([
          this.prisma.invoice.aggregate({
            where,
            _sum: { totalAmount: true },
          }),
          this.prisma.invoice.count({ where }),
        ]);
        return {
          month,
          totalAmount: agg._sum.totalAmount?.toString() ?? '0',
          invoiceCount,
        };
      }),
    );

    return { months, currency: 'TRY', points };
  }

  /** Sipariş kargoya verildi / teslim edildiğinde yerel taslak fatura */
  async createDraftFromOrder(
    organizationId: string,
    orderId: string,
  ): Promise<SerializedInvoice> {
    return this.invoiceService.createFromOrder(organizationId, orderId);
  }

  async createManual(
    organizationId: string,
    dto: CreateAccountingInvoiceDto,
  ): Promise<SerializedInvoice> {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException('Müşteri bulunamadı');
      }
      dto.customerName = dto.customerName || customer.name;
      dto.customerEmail = dto.customerEmail ?? customer.email ?? undefined;
      dto.customerPhone = dto.customerPhone ?? customer.phone ?? undefined;
    }

    const createDto: CreateInvoiceDto = {
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      customerAddress: dto.customerAddress,
      customerTaxId: dto.customerTaxId,
      items: dto.items,
      taxRate: dto.taxRate,
      currency: dto.currency,
      dueDate: dto.dueDate,
      notes: dto.notes,
      isEArchive: dto.isEArchive,
      orderId: dto.orderId,
    };

    return this.invoiceService.create(organizationId, createDto);
  }

  async issue(organizationId: string, id: string): Promise<SerializedInvoice> {
    const invoice = await this.requireInvoice(organizationId, id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Yalnızca taslak faturalar kesilebilir. Mevcut durum: ${toAccountingStatus(invoice.status)}`,
      );
    }
    return this.invoiceService.updateStatus(organizationId, id, InvoiceStatus.SENT);
  }

  async bulkIssue(
    organizationId: string,
    invoiceIds: string[],
  ): Promise<AccountingBulkResult> {
    return this.runBulkInvoiceAction(organizationId, invoiceIds, (orgId, id) =>
      this.issue(orgId, id),
    );
  }

  async bulkMarkPaid(
    organizationId: string,
    invoiceIds: string[],
  ): Promise<AccountingBulkResult> {
    return this.runBulkInvoiceAction(organizationId, invoiceIds, (orgId, id) =>
      this.markPaid(orgId, id, {}),
    );
  }

  async cancel(organizationId: string, id: string): Promise<SerializedInvoice> {
    const invoice = await this.requireInvoice(organizationId, id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Fatura zaten iptal edilmiş');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Ödenmiş fatura iptal edilemez');
    }
    return this.invoiceService.updateStatus(organizationId, id, InvoiceStatus.CANCELLED);
  }

  /** Kesilmiş faturayı ödenmiş işaretle (PAID + paidAt / paymentMethod) */
  async markPaid(
    organizationId: string,
    id: string,
    dto: MarkPaidAccountingInvoiceDto,
  ): Promise<SerializedInvoice> {
    const invoice = await this.requireInvoice(organizationId, id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Fatura zaten ödenmiş olarak işaretli');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('İptal edilmiş fatura ödenmiş olarak işaretlenemez');
    }
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Taslak faturayı önce kesin (issue)');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt,
        paymentMethod: dto.paymentMethod ?? null,
      },
    });

    return this.invoiceService.findOne(organizationId, id);
  }

  async pushToErp(
    organizationId: string,
    invoiceId: string,
    actorUserId: string,
    actorOrgId: string,
    isImpersonating: boolean,
    impersonatedOrgId: string | null,
  ): Promise<PushToErpResult> {
    const invoice = await this.requireInvoice(organizationId, invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('İptal edilmiş fatura ERP\'ye gönderilemez');
    }
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Faturayı önce kesin (issue), ardından ERP\'ye gönderin');
    }

    const connection = await this.prisma.erpConnection.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!connection) {
      throw new BadRequestException(
        'Aktif ERP bağlantısı bulunamadı. Ön muhasebe yerel olarak çalışır; harici ERP için Bağlantılar sayfasından Paraşüt veya BizimHesap ekleyin.',
      );
    }

    if (!this.adapterRegistry.hasErpAdapter(connection.erpType)) {
      throw new BadRequestException(
        'Bu ERP türü için fatura gönderimi desteklenmiyor.',
      );
    }

    const creds = this.parseCredentials(connection.credentialsEnc);
    if (!creds) {
      throw new BadRequestException('ERP kimlik bilgileri çözülemedi.');
    }

    const lines = this.invoiceItemsToErpLines(invoice.items, invoice.taxRate);
    const orderRef =
      invoice.orderId ??
      invoice.invoiceNumber;

    const adapter = this.adapterRegistry.getErp(connection.erpType);
    const erpInvoice = await adapter.createInvoice(
      { ...creds, organizationId },
      {
        orderRef,
        customerName: invoice.customerName,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        lines,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        actorOrgId,
        impersonatedOrgId: isImpersonating ? impersonatedOrgId : null,
        action: 'erp.invoice_created',
        resourceType: 'Invoice',
        resourceId: invoiceId,
        metadata: {
          invoiceNo: erpInvoice.invoiceNumber,
          connectionId: connection.id,
          erpType: connection.erpType,
          source: 'accounting',
        },
      },
    });

    this.logger.log('Fatura ERP\'ye gönderildi', {
      organizationId,
      invoiceId,
      erpType: connection.erpType,
      connectionId: connection.id,
    });

    return {
      erpInvoiceId: erpInvoice.erpInvoiceId,
      invoiceNumber: erpInvoice.invoiceNumber,
      erpType: connection.erpType,
      connectionId: connection.id,
    };
  }

  private async runBulkInvoiceAction(
    organizationId: string,
    invoiceIds: string[],
    action: (orgId: string, invoiceId: string) => Promise<SerializedInvoice>,
  ): Promise<AccountingBulkResult> {
    const result: AccountingBulkResult = { success: 0, failed: 0, errors: [] };

    for (const id of invoiceIds) {
      try {
        await action(organizationId, id);
        result.success += 1;
      } catch (error: unknown) {
        result.failed += 1;
        const message =
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException
            ? (error.message as string)
            : 'İşlem başarısız';
        result.errors.push({ id, message });
      }
    }

    return result;
  }

  private async requireInvoice(
    organizationId: string,
    id: string,
  ): Promise<Prisma.InvoiceGetPayload<object>> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    return row;
  }

  private parseCredentials(credentialsEnc: string): Record<string, string> | null {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') {
          out[k] = v;
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  private invoiceItemsToErpLines(
    raw: Prisma.JsonValue,
    defaultTaxRate: number,
  ): ErpInvoiceLine[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const lines: ErpInvoiceLine[] = [];
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
      const taxRate = typeof r.taxRate === 'number' ? r.taxRate : defaultTaxRate;
      const total =
        typeof r.total === 'number'
          ? r.total
          : Math.round(r.quantity * r.unitPrice * (1 + taxRate / 100) * 100) / 100;
      lines.push({
        description: r.name,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        taxRate,
        total,
      });
    }
    return lines;
  }
}
