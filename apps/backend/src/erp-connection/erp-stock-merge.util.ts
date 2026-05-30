import type { Prisma } from '@prisma/client';

/** ERP bağlantısı stok kaydı yazar ve merkezi stoku tüm ERP kaynaklarının toplamına günceller */
export async function upsertErpStockAndMergeCentral(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    erpConnectionId: string;
    warehouseId: string;
    barcode: string;
    quantity: number;
    productId: string | null;
  },
): Promise<number> {
  const existingErp = await tx.erpStockEntry.findFirst({
    where: {
      organizationId: params.organizationId,
      erpConnectionId: params.erpConnectionId,
      barcode: params.barcode,
      warehouseId: params.warehouseId,
    },
  });

  if (existingErp) {
    await tx.erpStockEntry.update({
      where: { id: existingErp.id },
      data: {
        quantity: params.quantity,
        ...(params.productId ? { productId: params.productId } : {}),
      },
    });
  } else {
    await tx.erpStockEntry.create({
      data: {
        organizationId: params.organizationId,
        erpConnectionId: params.erpConnectionId,
        warehouseId: params.warehouseId,
        barcode: params.barcode,
        quantity: params.quantity,
        productId: params.productId,
      },
    });
  }

  const aggregated = await tx.erpStockEntry.aggregate({
    where: {
      organizationId: params.organizationId,
      barcode: params.barcode,
      warehouseId: params.warehouseId,
    },
    _sum: { quantity: true },
  });
  const mergedQty = aggregated._sum.quantity ?? params.quantity;

  const existingCentral = await tx.stockEntry.findFirst({
    where: {
      organizationId: params.organizationId,
      barcode: params.barcode,
      platform: null,
      warehouseId: params.warehouseId,
    },
  });

  if (existingCentral) {
    await tx.stockEntry.update({
      where: { id: existingCentral.id },
      data: {
        quantity: mergedQty,
        ...(params.productId ? { productId: params.productId } : {}),
      },
    });
  } else {
    await tx.stockEntry.create({
      data: {
        organizationId: params.organizationId,
        warehouseId: params.warehouseId,
        barcode: params.barcode,
        platform: null,
        quantity: mergedQty,
        productId: params.productId,
      },
    });
  }

  return mergedQty;
}

/** ERP kaynak stok kaydını siler ve merkezi stoku kalan ERP kaynaklarına göre günceller */
export async function deleteErpStockAndMergeCentral(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    erpConnectionId: string;
    warehouseId: string;
    barcode: string;
    productId?: string | null;
  },
): Promise<number> {
  await tx.erpStockEntry.deleteMany({
    where: {
      organizationId: params.organizationId,
      erpConnectionId: params.erpConnectionId,
      barcode: params.barcode,
      warehouseId: params.warehouseId,
    },
  });

  const aggregated = await tx.erpStockEntry.aggregate({
    where: {
      organizationId: params.organizationId,
      barcode: params.barcode,
      warehouseId: params.warehouseId,
    },
    _sum: { quantity: true },
  });
  const mergedQty = aggregated._sum.quantity ?? 0;

  const existingCentral = await tx.stockEntry.findFirst({
    where: {
      organizationId: params.organizationId,
      barcode: params.barcode,
      platform: null,
      warehouseId: params.warehouseId,
    },
  });

  if (existingCentral) {
    if (mergedQty <= 0) {
      await tx.stockEntry.delete({ where: { id: existingCentral.id } });
    } else {
      await tx.stockEntry.update({
        where: { id: existingCentral.id },
        data: {
          quantity: mergedQty,
          ...(params.productId ? { productId: params.productId } : {}),
        },
      });
    }
  }

  return mergedQty;
}
