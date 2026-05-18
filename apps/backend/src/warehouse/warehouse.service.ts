import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockMovementType,
  type StockEntry,
  type Warehouse,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateWarehouseDto, TransferStockDto, UpdateWarehouseDto } from './warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateMainWarehouse(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Warehouse> {
    const db = tx ?? this.prisma;
    const existing = await db.warehouse.findFirst({
      where: { organizationId, code: 'MAIN' },
    });
    if (existing) {
      return existing;
    }
    return db.warehouse.create({
      data: {
        organizationId,
        name: 'Ana Depo',
        code: 'MAIN',
        isDefault: true,
        isActive: true,
      },
    });
  }

  async createWarehouse(
    organizationId: string,
    dto: CreateWarehouseDto,
  ): Promise<Warehouse> {
    const code = dto.code.trim().toUpperCase();
    const count = await this.prisma.warehouse.count({
      where: { organizationId },
    });
    const isFirst = count === 0;
    try {
      return await this.prisma.warehouse.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          code,
          address: dto.address?.trim() || null,
          isActive: dto.isActive ?? true,
          isDefault: isFirst,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu depo kodu zaten kullanılıyor.');
      }
      throw error;
    }
  }

  async listWarehouses(organizationId: string): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async updateWarehouse(
    organizationId: string,
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const row = await this.prisma.warehouse.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Depo bulunamadı.');
    }
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && {
          address: dto.address?.trim() || null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async setDefaultWarehouse(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.warehouse.findFirst({
      where: { id, organizationId, isActive: true },
    });
    if (!row) {
      throw new NotFoundException('Depo bulunamadı veya pasif.');
    }
    await this.prisma.$transaction([
      this.prisma.warehouse.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      }),
      this.prisma.warehouse.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
  }

  async deleteWarehouse(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.warehouse.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Depo bulunamadı.');
    }
    const stockCount = await this.prisma.stockEntry.count({
      where: { organizationId, warehouseId: id },
    });
    if (stockCount > 0) {
      throw new ConflictException(
        'Bu depoda stok kaydı var; önce stokları taşıyın veya sıfırlayın.',
      );
    }
    await this.prisma.warehouse.delete({ where: { id } });
  }

  async getWarehouseStock(
    organizationId: string,
    warehouseId: string,
  ): Promise<StockEntry[]> {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
    });
    if (!wh) {
      throw new NotFoundException('Depo bulunamadı.');
    }
    return this.prisma.stockEntry.findMany({
      where: { organizationId, warehouseId },
      orderBy: [{ barcode: 'asc' }, { platform: 'asc' }],
    });
  }

  async transferStock(
    organizationId: string,
    dto: TransferStockDto,
  ): Promise<void> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Kaynak ve hedef depo aynı olamaz.');
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

    await this.prisma.$transaction(async (tx) => {
      const source = await tx.stockEntry.findFirst({
        where: {
          organizationId,
          barcode: dto.barcode.trim(),
          platform: null,
          warehouseId: dto.fromWarehouseId,
        },
      });
      if (!source || source.quantity < dto.quantity) {
        throw new BadRequestException(
          'Kaynak depoda yeterli merkezi stok yok (yalnızca platform=null satırları transfer edilir).',
        );
      }
      const fromBefore = source.quantity;
      const fromAfter = fromBefore - dto.quantity;
      await tx.stockEntry.update({
        where: { id: source.id },
        data: { quantity: fromAfter },
      });
      await tx.stockMovement.create({
        data: {
          organizationId,
          barcode: dto.barcode.trim(),
          warehouseId: dto.fromWarehouseId,
          platform: null,
          movementType: StockMovementType.TRANSFER,
          quantity: -dto.quantity,
          beforeQuantity: fromBefore,
          afterQuantity: fromAfter,
          note: `Depo transferi → ${toWh.name}`,
        },
      });

      const target = await tx.stockEntry.findFirst({
        where: {
          organizationId,
          barcode: dto.barcode.trim(),
          platform: null,
          warehouseId: dto.toWarehouseId,
        },
      });
      const toBefore = target?.quantity ?? 0;
      const toAfter = toBefore + dto.quantity;
      const productId = source.productId ?? target?.productId ?? null;

      if (target) {
        await tx.stockEntry.update({
          where: { id: target.id },
          data: {
            quantity: { increment: dto.quantity },
            ...(productId && !target.productId ? { productId } : {}),
          },
        });
      } else {
        await tx.stockEntry.create({
          data: {
            organizationId,
            warehouseId: dto.toWarehouseId,
            barcode: dto.barcode.trim(),
            platform: null,
            quantity: dto.quantity,
            productId,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          organizationId,
          barcode: dto.barcode.trim(),
          warehouseId: dto.toWarehouseId,
          platform: null,
          movementType: StockMovementType.TRANSFER,
          quantity: dto.quantity,
          beforeQuantity: toBefore,
          afterQuantity: toAfter,
          note: `Depo transferi ← ${fromWh.name}`,
        },
      });
    });
  }
}
