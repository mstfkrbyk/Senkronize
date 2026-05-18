import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  POStatus,
  Prisma,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type Supplier,
} from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementService } from '../stock/stock-movement.service';
import { WarehouseService } from '../warehouse/warehouse.service';

import type {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  PurchaseSuggestionsQueryDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './purchase-order.dto';

const OPEN_PO_STATUSES: POStatus[] = [
  POStatus.DRAFT,
  POStatus.SENT,
  POStatus.CONFIRMED,
  POStatus.PARTIALLY_RECEIVED,
];

const RECEIVABLE_STATUSES: POStatus[] = [
  POStatus.SENT,
  POStatus.CONFIRMED,
  POStatus.PARTIALLY_RECEIVED,
];

export interface PurchaseOrderDetail extends PurchaseOrder {
  supplier: Supplier;
  items: PurchaseOrderItem[];
}

export interface ReplenishmentSuggestion {
  barcode: string;
  productName: string;
  currentQuantity: number;
  suggestedOrderQuantity: number;
  message: string;
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly warehouseService: WarehouseService,
    private readonly emailService: EmailService,
  ) {}

  private async generateOrderNumber(organizationId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const orderNumber = `PO-${new Date().getFullYear()}-${Date.now()}-${Math.floor(
        Math.random() * 1_000_000,
      )}`;
      const clash = await this.prisma.purchaseOrder.findFirst({
        where: { organizationId, orderNumber },
        select: { id: true },
      });
      if (!clash) {
        return orderNumber;
      }
    }
    const { randomUUID } = await import('crypto');
    return `PO-${randomUUID()}`;
  }

  async createPO(organizationId: string, dto: CreatePurchaseOrderDto): Promise<PurchaseOrderDetail> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('En az bir kalem ekleyin.');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException('Tedarikçi bulunamadı.');
    }

    const orderNumber = await this.generateOrderNumber(organizationId);
    let total = new Prisma.Decimal(0);
    const itemCreates: Prisma.PurchaseOrderItemCreateWithoutPurchaseOrderInput[] = [];

    for (const it of dto.items) {
      const qty = it.quantity;
      const unit = new Prisma.Decimal(it.unitCost);
      const lineTotal = unit.mul(qty);
      total = total.add(lineTotal);
      itemCreates.push({
        barcode: it.barcode.trim(),
        productName: it.productName.trim(),
        quantity: qty,
        orderedQty: qty,
        receivedQty: 0,
        unitCost: unit,
        totalCost: lineTotal,
      });
    }

    const po = await this.prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        orderNumber,
        status: POStatus.DRAFT,
        totalAmount: total,
        currency: (dto.currency ?? 'TRY').trim().toUpperCase().slice(0, 8),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        notes: dto.notes?.trim() || null,
        items: { create: itemCreates },
      },
      include: { supplier: true, items: true },
    });

    return po;
  }

  async findAll(
    organizationId: string,
    query: PurchaseOrderQueryDto,
  ): Promise<{ data: PurchaseOrderDetail[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(organizationId: string, id: string): Promise<PurchaseOrderDetail> {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { supplier: true, items: true },
    });
    if (!row) {
      throw new NotFoundException('Satın alma siparişi bulunamadı.');
    }
    return row;
  }

  async updatePO(
    organizationId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrderDetail> {
    const existing = await this.findOne(organizationId, id);
    if (existing.status === POStatus.CANCELLED || existing.status === POStatus.RECEIVED) {
      throw new BadRequestException('Bu durumdaki sipariş güncellenemez.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(dto.expectedDate !== undefined
          ? { expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: { supplier: true, items: true },
    });
  }

  async sendPO(organizationId: string, id: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOne(organizationId, id);
    if (po.status !== POStatus.DRAFT) {
      throw new BadRequestException('Yalnızca taslak siparişler gönderilebilir.');
    }
    const email = po.supplier.email?.trim();
    if (!email) {
      throw new BadRequestException('Tedarikçi e-posta adresi tanımlı değil.');
    }

    await this.emailService.sendPurchaseOrderToSupplier(email, {
      supplierName: po.supplier.name,
      orderNumber: po.orderNumber,
      organizationName: (
        await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        })
      )?.name ?? 'Senkronize',
      currency: po.currency,
      totalAmount: po.totalAmount.toFixed(2),
      itemLines: po.items.map(
        (i) =>
          `${i.productName} (${i.barcode}) — ${i.orderedQty} ad. × ${i.unitCost.toFixed(2)} ${po.currency}`,
      ),
      notes: po.notes,
    });

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.SENT },
      include: { supplier: true, items: true },
    });
  }

  async receiveItems(
    organizationId: string,
    id: string,
    dto: ReceivePurchaseOrderDto,
  ): Promise<PurchaseOrderDetail> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Teslim kalemleri gerekli.');
    }

    const po = await this.findOne(organizationId, id);
    if (!RECEIVABLE_STATUSES.includes(po.status)) {
      throw new BadRequestException('Bu sipariş için teslim alma yapılamaz.');
    }

    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(organizationId);

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.purchaseOrder.findFirst({
        where: { id, organizationId },
        include: { items: true },
      });
      if (!fresh) {
        throw new NotFoundException('Satın alma siparişi bulunamadı.');
      }

      const itemByBarcode = new Map(
        fresh.items.map((it) => [it.barcode.trim().toLowerCase(), it]),
      );

      for (const rec of dto.items) {
        const key = rec.barcode.trim().toLowerCase();
        const line = itemByBarcode.get(key);
        if (!line) {
          throw new BadRequestException(`Bu siparişte bulunmayan barkod: ${rec.barcode}`);
        }
        const remaining = line.orderedQty - line.receivedQty;
        if (rec.quantity > remaining) {
          throw new BadRequestException(
            `${rec.barcode} için en fazla ${remaining} adet teslim alınabilir.`,
          );
        }
        const newReceived = line.receivedQty + rec.quantity;
        await tx.purchaseOrderItem.update({
          where: { id: line.id },
          data: { receivedQty: newReceived },
        });

        const note = `Satın alma ${fresh.orderNumber}`;
        await this.stockMovementService.applyPurchaseInflow(
          organizationId,
          mainWh.id,
          line.barcode,
          rec.quantity,
          note,
          tx,
        );
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });
      const allReceived = updatedItems.every((it) => it.receivedQty >= it.orderedQty);
      const anyReceived = updatedItems.some((it) => it.receivedQty > 0);
      let nextStatus: POStatus = fresh.status;
      if (allReceived) {
        nextStatus = POStatus.RECEIVED;
      } else if (anyReceived) {
        nextStatus = POStatus.PARTIALLY_RECEIVED;
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedAt: allReceived ? new Date() : fresh.receivedAt ?? null,
        },
      });
    });

    return this.findOne(organizationId, id);
  }

  async cancelPO(organizationId: string, id: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOne(organizationId, id);
    if (po.status === POStatus.CANCELLED) {
      throw new BadRequestException('Sipariş zaten iptal edilmiş.');
    }
    if (po.status === POStatus.RECEIVED) {
      throw new BadRequestException('Tamamlanmış sipariş iptal edilemez.');
    }
    if (po.items.some((it) => it.receivedQty > 0)) {
      throw new BadRequestException('Kısmen teslim alınmış sipariş iptal edilemez.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.CANCELLED },
      include: { supplier: true, items: true },
    });
  }

  async getOpenPOs(organizationId: string): Promise<PurchaseOrderDetail[]> {
    return this.prisma.purchaseOrder.findMany({
      where: { organizationId, status: { in: OPEN_PO_STATUSES } },
      include: { supplier: true, items: true },
      orderBy: { expectedDate: 'asc' },
    });
  }

  async getReplenishmentSuggestions(
    organizationId: string,
    query: PurchaseSuggestionsQueryDto,
  ): Promise<ReplenishmentSuggestion[]> {
    const threshold = query.threshold ?? 5;
    const grouped = await this.prisma.stockEntry.groupBy({
      by: ['barcode'],
      where: { organizationId, platform: null },
      _sum: { quantity: true },
    });

    const low = grouped.filter((g) => (g._sum.quantity ?? 0) < threshold);
    if (low.length === 0) {
      return [];
    }

    const barcodes = low.map((g) => g.barcode);
    const products = await this.prisma.product.findMany({
      where: { organizationId, barcode: { in: barcodes }, deletedAt: null },
      select: { barcode: true, name: true },
    });
    const nameByBarcode = new Map(products.map((p) => [p.barcode.toLowerCase(), p.name]));

    return low.map((g) => {
      const current = g._sum.quantity ?? 0;
      const suggested = Math.max(threshold * 2 - current, threshold);
      const name = nameByBarcode.get(g.barcode.toLowerCase()) ?? g.barcode;
      return {
        barcode: g.barcode,
        productName: name,
        currentQuantity: current,
        suggestedOrderQuantity: suggested,
        message: `Stok ${current} adet; önerilen sipariş miktarı yaklaşık ${suggested} adet.`,
      };
    });
  }
}
