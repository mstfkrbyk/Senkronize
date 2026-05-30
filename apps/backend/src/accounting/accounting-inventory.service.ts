import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { AccountingInventoryValuation } from './accounting.types';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AccountingInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventoryValuation(
    organizationId: string,
    warehouseId?: string,
  ): Promise<AccountingInventoryValuation> {
    if (warehouseId?.trim()) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId },
        select: { id: true },
      });
      if (!warehouse) {
        throw new NotFoundException('Depo bulunamadı');
      }
    }

    const entries = await this.prisma.stockEntry.findMany({
      where: {
        organizationId,
        ...(warehouseId?.trim() ? { warehouseId: warehouseId.trim() } : {}),
      },
      select: {
        quantity: true,
        barcode: true,
        product: {
          where: { deletedAt: null },
          select: { costPrice: true },
        },
      },
    });

    let totalQuantity = 0;
    let totalValue = 0;
    const skusWithStock = new Set<string>();

    for (const entry of entries) {
      if (entry.quantity <= 0) {
        continue;
      }
      const unitCost =
        entry.product?.costPrice != null ? Number(entry.product.costPrice) : 0;
      totalQuantity += entry.quantity;
      totalValue += entry.quantity * unitCost;
      skusWithStock.add(entry.barcode);
    }

    return {
      warehouseId: warehouseId?.trim() ? warehouseId.trim() : null,
      totalQuantity,
      totalValue: roundMoney(totalValue).toFixed(2),
      skuCount: skusWithStock.size,
      currency: 'TRY',
    };
  }
}
