import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType, TransferStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { resolveProductStockKey } from '../common/product-match-key';

import type {
  CreateStockTransferDto,
  ListStockTransfersQueryDto,
} from './stock.dto';

export interface StockTransferItemDto {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string | null;
  quantity: number;
}

export interface StockTransferRowDto {
  id: string;
  organizationId: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  fromWarehouseCode: string;
  toWarehouseId: string;
  toWarehouseName: string;
  toWarehouseCode: string;
  status: TransferStatus;
  note: string | null;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totalQuantity: number;
}

export interface StockTransferDetailDto extends StockTransferRowDto {
  items: StockTransferItemDto[];
}

@Injectable()
export class StockTransferService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(
    row: {
      id: string;
      organizationId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      status: TransferStatus;
      note: string | null;
      createdBy: string;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      fromWarehouse: { name: string; code: string };
      toWarehouse: { name: string; code: string };
      items: { quantity: number }[];
    },
  ): StockTransferRowDto {
    const totalQuantity = row.items.reduce((sum, it) => sum + it.quantity, 0);
    return {
      id: row.id,
      organizationId: row.organizationId,
      fromWarehouseId: row.fromWarehouseId,
      fromWarehouseName: row.fromWarehouse.name,
      fromWarehouseCode: row.fromWarehouse.code,
      toWarehouseId: row.toWarehouseId,
      toWarehouseName: row.toWarehouse.name,
      toWarehouseCode: row.toWarehouse.code,
      status: row.status,
      note: row.note,
      createdBy: row.createdBy,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      itemCount: row.items.length,
      totalQuantity,
    };
  }

  async createTransfer(
    organizationId: string,
    userId: string,
    dto: CreateStockTransferDto,
  ): Promise<{ data: StockTransferDetailDto }> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Kaynak ve hedef depo aynı olamaz.');
    }
    if (dto.items.length === 0) {
      throw new BadRequestException('En az bir ürün satırı ekleyin.');
    }

    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.fromWarehouseId, organizationId, isActive: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.toWarehouseId, organizationId, isActive: true },
      }),
    ]);
    if (!fromWh || !toWh) {
      throw new NotFoundException('Depo bulunamadı veya pasif.');
    }

    const productIds = [...new Set(dto.items.map((it) => it.productId))];
    const products = await this.prisma.product.findMany({
      where: { organizationId, id: { in: productIds }, deletedAt: null },
      select: { id: true, name: true, barcode: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Bir veya daha fazla ürün bulunamadı.');
    }

    const transfer = await this.prisma.stockTransfer.create({
      data: {
        organizationId,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        note: dto.note?.trim() || null,
        createdBy: userId,
        items: {
          create: dto.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        },
      },
      include: {
        fromWarehouse: { select: { name: true, code: true } },
        toWarehouse: { select: { name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, sku: true } },
          },
        },
      },
    });

    return {
      data: {
        ...this.mapRow(transfer),
        items: transfer.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.product.name,
          productBarcode: it.product.barcode,
          quantity: it.quantity,
        })),
      },
    };
  }

  async getTransfer(
    organizationId: string,
    id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, organizationId },
      include: {
        fromWarehouse: { select: { name: true, code: true } },
        toWarehouse: { select: { name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, sku: true } },
          },
        },
      },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer bulunamadı.');
    }
    return {
      data: {
        ...this.mapRow(transfer),
        items: transfer.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.product.name,
          productBarcode: it.product.barcode,
          quantity: it.quantity,
        })),
      },
    };
  }

  async listTransfers(
    organizationId: string,
    filters: ListStockTransfersQueryDto,
  ): Promise<{ data: StockTransferRowDto[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.fromWarehouseId
        ? { fromWarehouseId: filters.fromWarehouseId }
        : {}),
      ...(filters.toWarehouseId ? { toWarehouseId: filters.toWarehouseId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: { select: { name: true, code: true } },
          toWarehouse: { select: { name: true, code: true } },
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.mapRow(row)),
      total,
    };
  }

  async confirmTransfer(
    organizationId: string,
    id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, organizationId },
      include: {
        fromWarehouse: { select: { name: true, code: true } },
        toWarehouse: { select: { name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, sku: true } },
          },
        },
      },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer bulunamadı.');
    }
    if (
      transfer.status !== TransferStatus.DRAFT &&
      transfer.status !== TransferStatus.IN_TRANSIT
    ) {
      throw new BadRequestException('Bu transfer onaylanamaz.');
    }
    if (transfer.items.length === 0) {
      throw new BadRequestException('Transfer kalemi yok.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const barcode = resolveProductStockKey(item.product);
        if (!barcode) {
          throw new BadRequestException(
            `${item.product.name} için barkod veya SKU tanımlı değil.`,
          );
        }
        const source = await tx.stockEntry.findFirst({
          where: {
            organizationId,
            barcode,
            platform: null,
            warehouseId: transfer.fromWarehouseId,
          },
        });
        if (!source || source.quantity < item.quantity) {
          throw new BadRequestException(
            `${item.product.name} için kaynak depoda yeterli stok yok.`,
          );
        }

        const fromBefore = source.quantity;
        const fromAfter = fromBefore - item.quantity;
        await tx.stockEntry.update({
          where: { id: source.id },
          data: { quantity: fromAfter },
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            barcode,
            warehouseId: transfer.fromWarehouseId,
            platform: null,
            movementType: StockMovementType.TRANSFER,
            quantity: -item.quantity,
            beforeQuantity: fromBefore,
            afterQuantity: fromAfter,
            note: `Transfer ${transfer.id} → ${transfer.toWarehouse.name}`,
          },
        });

        const target = await tx.stockEntry.findFirst({
          where: {
            organizationId,
            barcode,
            platform: null,
            warehouseId: transfer.toWarehouseId,
          },
        });
        const toBefore = target?.quantity ?? 0;
        const toAfter = toBefore + item.quantity;

        if (target) {
          await tx.stockEntry.update({
            where: { id: target.id },
            data: {
              quantity: toAfter,
              productId: item.productId,
            },
          });
        } else {
          await tx.stockEntry.create({
            data: {
              organizationId,
              warehouseId: transfer.toWarehouseId,
              barcode,
              platform: null,
              quantity: item.quantity,
              productId: item.productId,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            barcode,
            warehouseId: transfer.toWarehouseId,
            platform: null,
            movementType: StockMovementType.TRANSFER,
            quantity: item.quantity,
            beforeQuantity: toBefore,
            afterQuantity: toAfter,
            note: `Transfer ${transfer.id} ← ${transfer.fromWarehouse.name}`,
          },
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    return this.getTransfer(organizationId, id);
  }

  async cancelTransfer(
    organizationId: string,
    id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, organizationId },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer bulunamadı.');
    }
    if (
      transfer.status !== TransferStatus.DRAFT &&
      transfer.status !== TransferStatus.IN_TRANSIT
    ) {
      throw new BadRequestException('Bu transfer iptal edilemez.');
    }

    await this.prisma.stockTransfer.update({
      where: { id },
      data: { status: TransferStatus.CANCELLED },
    });

    return this.getTransfer(organizationId, id);
  }
}
