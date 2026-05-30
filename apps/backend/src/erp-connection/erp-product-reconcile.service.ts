import { Injectable, Logger } from '@nestjs/common';

import { resolveProductStockKey } from '../common/product-match-key';
import { PrismaService } from '../prisma/prisma.service';
import { WarehouseService } from '../warehouse/warehouse.service';

import { deleteErpStockAndMergeCentral } from './erp-stock-merge.util';

export interface ErpProductReconcileResult {
  staleStockEntries: number;
  removedProducts: number;
}

@Injectable()
export class ErpProductReconcileService {
  private readonly logger = new Logger(ErpProductReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
  ) {}

  /**
   * ERP import filtresine artık uymayan ürünleri soft-delete eder;
   * ilgili ERP stok kayıtlarını kaldırıp merkezi stoku yeniden hesaplar.
   */
  async reconcileAfterImport(
    organizationId: string,
    erpConnectionId: string,
    syncedStockKeys: ReadonlySet<string>,
  ): Promise<ErpProductReconcileResult> {
    const connection = await this.prisma.erpConnection.findFirst({
      where: { id: erpConnectionId, organizationId, deletedAt: null },
      select: { role: true },
    });
    if (!connection) {
      return { staleStockEntries: 0, removedProducts: 0 };
    }

    const mainWh =
      await this.warehouseService.getOrCreateMainWarehouse(organizationId);

    const erpStockRows = await this.prisma.erpStockEntry.findMany({
      where: { organizationId, erpConnectionId },
      select: { id: true, barcode: true, productId: true },
    });

    const staleStockRows = erpStockRows.filter(
      (row) => !syncedStockKeys.has(row.barcode),
    );

    for (const row of staleStockRows) {
      await this.prisma.$transaction(async (tx) => {
        await deleteErpStockAndMergeCentral(tx, {
          organizationId,
          erpConnectionId,
          warehouseId: mainWh.id,
          barcode: row.barcode,
          productId: row.productId,
        });
      });
    }

    const candidates = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { sourceErpConnectionId: erpConnectionId },
          {
            sourceErpConnectionId: null,
            erpStockEntries: { some: { erpConnectionId } },
          },
        ],
      },
      select: {
        id: true,
        barcode: true,
        sku: true,
        sourceErpConnectionId: true,
        listings: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
        erpStockEntries: {
          select: { erpConnectionId: true },
        },
      },
    });

    let removedProducts = 0;
    for (const product of candidates) {
      const stockKey = resolveProductStockKey(product);
      if (!stockKey || syncedStockKeys.has(stockKey)) {
        continue;
      }
      if (product.listings.length > 0) {
        continue;
      }
      if (
        product.sourceErpConnectionId &&
        product.sourceErpConnectionId !== erpConnectionId
      ) {
        continue;
      }
      if (!product.sourceErpConnectionId) {
        const hasOtherErpStock = product.erpStockEntries.some(
          (entry) => entry.erpConnectionId !== erpConnectionId,
        );
        if (hasOtherErpStock) {
          continue;
        }
      }

      await this.prisma.product.update({
        where: { id: product.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      removedProducts += 1;
    }

    if (connection.role === 'SECONDARY') {
      const primaryConnectionIds = new Set(
        (
          await this.prisma.erpConnection.findMany({
            where: {
              organizationId,
              role: 'PRIMARY',
              deletedAt: null,
              isActive: true,
            },
            select: { id: true },
          })
        ).map((row) => row.id),
      );

      const legacyOrphans = await this.prisma.product.findMany({
        where: {
          organizationId,
          deletedAt: null,
          sourceErpConnectionId: null,
          listings: { none: { deletedAt: null } },
        },
        select: {
          id: true,
          barcode: true,
          sku: true,
          erpStockEntries: { select: { erpConnectionId: true } },
        },
      });

      for (const product of legacyOrphans) {
        const stockKey = resolveProductStockKey(product);
        if (!stockKey || syncedStockKeys.has(stockKey)) {
          continue;
        }
        const hasPrimaryErpStock = product.erpStockEntries.some((entry) =>
          primaryConnectionIds.has(entry.erpConnectionId),
        );
        if (hasPrimaryErpStock) {
          continue;
        }
        const hasForeignErpStock = product.erpStockEntries.some(
          (entry) => entry.erpConnectionId !== erpConnectionId,
        );
        if (hasForeignErpStock) {
          continue;
        }

        await this.prisma.product.update({
          where: { id: product.id },
          data: { deletedAt: new Date(), isActive: false },
        });
        removedProducts += 1;
      }
    }

    if (staleStockRows.length > 0 || removedProducts > 0) {
      this.logger.log('ERP import reconcile tamamlandı', {
        organizationId,
        erpConnectionId,
        staleStockEntries: staleStockRows.length,
        removedProducts,
        activeImportCount: syncedStockKeys.size,
      });
    }

    return {
      staleStockEntries: staleStockRows.length,
      removedProducts,
    };
  }
}
