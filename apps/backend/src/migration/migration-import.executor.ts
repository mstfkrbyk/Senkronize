import { Injectable, Logger } from '@nestjs/common';
import {
  Marketplace,
  OrderStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StockMovementService } from '../stock/stock-movement.service';
import { WarehouseService } from '../warehouse/warehouse.service';

import type {
  CustomerImportDto,
  OrderImportDto,
  ProductImportDto,
  StockMovementImportDto,
} from './migration.import-dto';
import { applyColumnMapping } from './migration.mapper';
import type {
  MigrationDataType,
  MigrationFieldIssue,
  MigrationImportResult,
  MigrationSessionProgress,
  MigrationSourceFormat,
} from './migration.types';
import { transformRow } from './transformers';

export interface MigrationBatchResult {
  progress: MigrationSessionProgress;
  rowErrors: MigrationFieldIssue[];
}

@Injectable()
export class MigrationImportExecutor {
  private readonly logger = new Logger(MigrationImportExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  async executeBatch(
    organizationId: string,
    dataType: MigrationDataType,
    sourceFormat: MigrationSourceFormat,
    rawRows: Record<string, string>[],
    columnMapping: Record<string, string>,
    startIndex: number,
    progress: MigrationSessionProgress,
  ): Promise<MigrationBatchResult> {
    const rowErrors: MigrationFieldIssue[] = [];
    const batchSize = Math.min(100, rawRows.length - startIndex);

    for (let i = 0; i < batchSize; i++) {
      const globalIndex = startIndex + i;
      const raw = rawRows[globalIndex];
      if (!raw) {
        continue;
      }
      const rowIndex = globalIndex + 2;
      progress.processed++;

      try {
        const mapped = applyColumnMapping(raw, columnMapping);
        const normalized = transformRow(sourceFormat, dataType, mapped);

        switch (dataType) {
          case 'products':
            await this.importProduct(organizationId, normalized as ProductImportDto);
            break;
          case 'orders':
            await this.importOrder(organizationId, normalized as OrderImportDto);
            break;
          case 'customers':
            await this.importCustomer(organizationId, normalized as CustomerImportDto);
            break;
          case 'stock_movements':
            await this.importStockMovement(
              organizationId,
              normalized as StockMovementImportDto,
            );
            break;
        }
        progress.imported++;
      } catch (error) {
        progress.failed++;
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.warn('Migration satırı atlandı', {
          organizationId,
          rowIndex,
        });
        rowErrors.push({ row: rowIndex, field: '_row', message });
      }
    }

    return { progress, rowErrors };
  }

  private async importProduct(
    organizationId: string,
    dto: ProductImportDto,
  ): Promise<void> {
    const barcode = dto.barcode?.trim() || dto.sku?.trim() || '';
    if (!barcode || !dto.name?.trim()) {
      throw new Error('SKU/barkod veya ürün adı eksik');
    }

    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
      organizationId,
    );

    const existing = await this.prisma.product.findFirst({
      where: { organizationId, barcode, deletedAt: null },
    });

    const qty = dto.stock ?? 0;

    await this.prisma.$transaction(async (tx) => {
      let productId: string;

      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            name: dto.name,
            sku: dto.sku ?? existing.sku,
            category: dto.category ?? existing.category,
            brand: dto.brand ?? existing.brand,
            description: dto.description ?? existing.description,
            deletedAt: null,
            ...(dto.imageUrl
              ? {
                  imageUrls: existing.imageUrls.includes(dto.imageUrl)
                    ? existing.imageUrls
                    : { push: dto.imageUrl },
                }
              : {}),
          },
        });
        productId = existing.id;
      } else {
        const created = await tx.product.create({
          data: {
            organizationId,
            barcode,
            sku: dto.sku ?? null,
            name: dto.name,
            category: dto.category,
            brand: dto.brand,
            description: dto.description,
            imageUrls: dto.imageUrl ? [dto.imageUrl] : [],
          },
        });
        productId = created.id;
      }

      const stockRow = await tx.stockEntry.findFirst({
        where: {
          organizationId,
          barcode,
          platform: null,
          warehouseId: mainWh.id,
        },
      });
      if (stockRow) {
        await tx.stockEntry.update({
          where: { id: stockRow.id },
          data: { quantity: qty, productId },
        });
      } else {
        await tx.stockEntry.create({
          data: {
            organizationId,
            warehouseId: mainWh.id,
            barcode,
            platform: null,
            quantity: qty,
            productId,
          },
        });
      }
    });
  }

  private async importOrder(
    organizationId: string,
    dto: OrderImportDto,
  ): Promise<void> {
    const platform = this.resolveMarketplace(dto.platform);
    const platformOrderId = dto.platformOrderId.trim();
    if (!platformOrderId) {
      throw new Error('Sipariş numarası eksik');
    }

    const existing = await this.prisma.order.findFirst({
      where: {
        organizationId,
        platform,
        platformOrderId,
        deletedAt: null,
      },
    });

    if (existing) {
      await this.prisma.order.update({
        where: { id: existing.id },
        data: {
          customerName: dto.customerName,
          totalAmount: dto.totalAmount,
          syncedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.order.create({
      data: {
        organizationId,
        platform,
        platformOrderId,
        status: OrderStatus.NEW,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone ?? null,
        shippingAddress: dto.shippingAddress ?? null,
        totalAmount: dto.totalAmount,
        currency: dto.currency ?? 'TRY',
        cargoTrackingNumber: dto.cargoTrackingNumber ?? null,
        cargoProvider: dto.cargoProvider ?? null,
        platformCreatedAt: new Date(dto.orderDate),
        items: {
          create: dto.items.map((item) => ({
            organizationId,
            sku: item.sku || item.barcode,
            barcode: item.barcode || item.sku,
            productName: item.productName ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });
  }

  private async importCustomer(
    organizationId: string,
    dto: CustomerImportDto,
  ): Promise<void> {
    if (!dto.name?.trim()) {
      throw new Error('Müşteri adı eksik');
    }

    const platform = dto.platform
      ? this.resolveMarketplace(dto.platform)
      : null;
    const externalId = dto.externalId ?? dto.email ?? dto.phone ?? dto.name;

    if (platform && externalId) {
      await this.prisma.customer.upsert({
        where: {
          organizationId_platform_externalId: {
            organizationId,
            platform,
            externalId,
          },
        },
        create: {
          organizationId,
          platform,
          externalId,
          name: dto.name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
        },
        update: {
          name: dto.name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          deletedAt: null,
        },
      });
      return;
    }

    await this.prisma.customer.create({
      data: {
        organizationId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
      },
    });
  }

  private async importStockMovement(
    organizationId: string,
    dto: StockMovementImportDto,
  ): Promise<void> {
    const barcode = dto.barcode.trim();
    if (!barcode) {
      throw new Error('Barkod eksik');
    }

    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
      organizationId,
    );
    const stockRow = await this.prisma.stockEntry.findFirst({
      where: {
        organizationId,
        barcode,
        warehouseId: mainWh.id,
        platform: dto.platform ?? null,
      },
    });

    const before = stockRow?.quantity ?? 0;
    const delta = dto.movementType === 'out' ? -dto.quantity : dto.quantity;
    const after = Math.max(0, before + delta);

    await this.prisma.$transaction(async (tx) => {
      if (stockRow) {
        await tx.stockEntry.update({
          where: { id: stockRow.id },
          data: { quantity: after },
        });
      } else if (dto.movementType === 'in') {
        await tx.stockEntry.create({
          data: {
            organizationId,
            warehouseId: mainWh.id,
            barcode,
            platform: dto.platform ?? null,
            quantity: after,
          },
        });
      }

      await this.stockMovementService.record({
        organizationId,
        barcode,
        warehouseId: mainWh.id,
        platform: dto.platform ?? null,
        movementType: StockMovementType.ADJUSTMENT,
        quantity: delta,
        beforeQuantity: before,
        afterQuantity: after,
        note: dto.note ?? 'Veri taşıma içe aktarma',
        tx,
      });
    });
  }

  private resolveMarketplace(platform: string): Marketplace {
    const key = platform.trim().toUpperCase().replace(/\s/g, '_');
    if (Object.values(Marketplace).includes(key as Marketplace)) {
      return key as Marketplace;
    }
    return Marketplace.TRENDYOL;
  }

  toLegacyProductResult(progress: MigrationSessionProgress): MigrationImportResult {
    return {
      imported: progress.imported,
      updated: progress.updated,
      skipped: progress.skipped,
      errors: [],
    };
  }
}
