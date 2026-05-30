import { InjectQueue } from '@nestjs/bull';
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
import type { Queue } from 'bull';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveProductStockKey } from '../common/product-match-key';
import {
  LISTING_SYNC_STOCK_JOB_OPTIONS,
  QUEUE_LISTING_SYNC,
} from '../queue/queue.constants';
import { StockMovementService } from '../stock/stock-movement.service';
import { SupplierService } from '../supplier/supplier.service';
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

const PENDING_STATUSES: POStatus[] = [
  POStatus.DRAFT,
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

export interface TopSupplierAnalytics {
  supplierId: string;
  name: string;
  orders: number;
  amount: number;
}

export interface MonthlySpendPoint {
  month: string;
  amount: number;
}

export interface PurchaseOrderAnalytics {
  totalOrders: number;
  totalAmount: number;
  pendingOrders: number;
  avgLeadTime: number;
  topSuppliers: TopSupplierAnalytics[];
  monthlySpend: MonthlySpendPoint[];
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly warehouseService: WarehouseService,
    private readonly emailService: EmailService,
    private readonly supplierService: SupplierService,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue,
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

      let productId: string | null = it.productId ?? null;
      if (productId) {
        const product = await this.prisma.product.findFirst({
          where: { id: productId, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!product) {
          throw new BadRequestException(`Ürün bulunamadı: ${productId}`);
        }
      } else {
        const product = await this.prisma.product.findFirst({
          where: { organizationId, barcode: it.barcode.trim(), deletedAt: null },
          select: { id: true },
        });
        productId = product?.id ?? null;
      }

      total = total.add(lineTotal);
      itemCreates.push({
        ...(productId ? { product: { connect: { id: productId } } } : {}),
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
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
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
    if (existing.status !== POStatus.DRAFT) {
      throw new BadRequestException('Yalnızca taslak siparişler güncellenebilir.');
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
      data: { status: POStatus.SENT, sentAt: new Date() },
      include: { supplier: true, items: true },
    });
  }

  async confirmPO(organizationId: string, id: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOne(organizationId, id);
    if (po.status !== POStatus.SENT) {
      throw new BadRequestException('Yalnızca gönderilmiş siparişler onaylanabilir.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.CONFIRMED, confirmedAt: new Date() },
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
    const affectedBarcodes = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.purchaseOrder.findFirst({
        where: { id, organizationId },
        include: { items: true },
      });
      if (!fresh) {
        throw new NotFoundException('Satın alma siparişi bulunamadı.');
      }

      const itemByProductId = new Map(
        fresh.items.filter((it) => it.productId).map((it) => [it.productId as string, it]),
      );
      const itemByBarcode = new Map(
        fresh.items.map((it) => [it.barcode.trim().toLowerCase(), it]),
      );

      for (const rec of dto.items) {
        let line: PurchaseOrderItem | undefined;
        if (rec.productId) {
          line = itemByProductId.get(rec.productId);
          if (!line) {
            throw new BadRequestException(`Bu siparişte bulunmayan ürün: ${rec.productId}`);
          }
        } else if (rec.barcode) {
          line = itemByBarcode.get(rec.barcode.trim().toLowerCase());
          if (!line) {
            throw new BadRequestException(`Bu siparişte bulunmayan barkod: ${rec.barcode}`);
          }
        } else {
          throw new BadRequestException('Her kalem için productId veya barcode gerekli.');
        }

        const remaining = line.orderedQty - line.receivedQty;
        if (rec.receivedQty > remaining) {
          throw new BadRequestException(
            `${line.barcode} için en fazla ${remaining} adet teslim alınabilir.`,
          );
        }

        const newReceived = line.receivedQty + rec.receivedQty;
        await tx.purchaseOrderItem.update({
          where: { id: line.id },
          data: { receivedQty: newReceived },
        });

        const note = dto.notes?.trim()
          ? `Satın alma ${fresh.orderNumber}: ${dto.notes.trim()}`
          : `Satın alma ${fresh.orderNumber}`;

        await this.stockMovementService.applyPurchaseInflow(
          organizationId,
          mainWh.id,
          line.barcode,
          rec.receivedQty,
          note,
          tx,
        );

        affectedBarcodes.add(line.barcode.trim());
        line.receivedQty = newReceived;
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

      const notesAppend = dto.notes?.trim();
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedAt: allReceived ? new Date() : fresh.receivedAt ?? null,
          ...(notesAppend
            ? {
                notes: fresh.notes
                  ? `${fresh.notes}\n[Teslim] ${notesAppend}`
                  : `[Teslim] ${notesAppend}`,
              }
            : {}),
        },
      });
    });

    if (affectedBarcodes.size > 0) {
      await this.triggerListingSync(organizationId, mainWh.id, [...affectedBarcodes]);
    }

    const updated = await this.findOne(organizationId, id);
    if (updated.status === POStatus.RECEIVED) {
      await this.supplierService.recalculateRating(organizationId, updated.supplierId);
    }

    return updated;
  }

  private async triggerListingSync(
    organizationId: string,
    warehouseId: string,
    barcodes: string[],
  ): Promise<void> {
    for (const barcode of barcodes) {
      const entry = await this.prisma.stockEntry.findFirst({
        where: {
          organizationId,
          barcode,
          platform: null,
          warehouseId,
        },
        select: { quantity: true },
      });
      const stock = entry?.quantity ?? 0;
      await this.listingSyncQueue.add(
        'sync-stock',
        { orgId: organizationId, barcode, stock },
        LISTING_SYNC_STOCK_JOB_OPTIONS,
      );
    }
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

  async getAnalytics(organizationId: string): Promise<PurchaseOrderAnalytics> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [totalAgg, pendingCount, receivedOrders, supplierGroups, monthlyRows] =
      await Promise.all([
        this.prisma.purchaseOrder.aggregate({
          where: { organizationId, status: { not: POStatus.CANCELLED } },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.purchaseOrder.count({
          where: { organizationId, status: { in: PENDING_STATUSES } },
        }),
        this.prisma.purchaseOrder.findMany({
          where: {
            organizationId,
            status: POStatus.RECEIVED,
            receivedAt: { not: null },
          },
          select: { sentAt: true, createdAt: true, receivedAt: true },
        }),
        this.prisma.purchaseOrder.groupBy({
          by: ['supplierId'],
          where: {
            organizationId,
            status: { not: POStatus.CANCELLED },
          },
          _count: { id: true },
          _sum: { totalAmount: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 5,
        }),
        this.prisma.purchaseOrder.findMany({
          where: {
            organizationId,
            status: { not: POStatus.CANCELLED },
            createdAt: { gte: twelveMonthsAgo },
          },
          select: { createdAt: true, totalAmount: true },
        }),
      ]);

    let avgLeadTime = 0;
    if (receivedOrders.length > 0) {
      const totalDays = receivedOrders.reduce((sum, o) => {
        const start = o.sentAt ?? o.createdAt;
        const end = o.receivedAt as Date;
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgLeadTime = Math.round((totalDays / receivedOrders.length) * 10) / 10;
    }

    const supplierIds = supplierGroups.map((g) => g.supplierId);
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId, id: { in: supplierIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

    const topSuppliers: TopSupplierAnalytics[] = supplierGroups.map((g) => ({
      supplierId: g.supplierId,
      name: nameById.get(g.supplierId) ?? '—',
      orders: g._count.id,
      amount: Number(g._sum.totalAmount ?? 0),
    }));

    const monthlyMap = new Map<string, number>();
    for (const row of monthlyRows) {
      const key = row.createdAt.toISOString().slice(0, 7);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(row.totalAmount));
    }
    const monthlySpend: MonthlySpendPoint[] = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

    return {
      totalOrders: totalAgg._count.id,
      totalAmount: Number(totalAgg._sum.totalAmount ?? 0),
      pendingOrders: pendingCount,
      avgLeadTime,
      topSuppliers,
      monthlySpend,
    };
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
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { barcode: { in: barcodes } },
          { sku: { in: barcodes } },
        ],
      },
      select: { barcode: true, sku: true, name: true },
    });
    const nameByStockKey = new Map<string, string>();
    for (const p of products) {
      const key = resolveProductStockKey(p);
      if (key) {
        nameByStockKey.set(key.toLowerCase(), p.name);
      }
      if (p.barcode) {
        nameByStockKey.set(p.barcode.toLowerCase(), p.name);
      }
      if (p.sku) {
        nameByStockKey.set(p.sku.toLowerCase(), p.name);
      }
    }

    return low.map((g) => {
      const current = g._sum.quantity ?? 0;
      const suggested = Math.max(threshold * 2 - current, threshold);
      const name = nameByStockKey.get(g.barcode.toLowerCase()) ?? g.barcode;
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
