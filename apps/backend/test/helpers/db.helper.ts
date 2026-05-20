import type { INestApplication } from '@nestjs/common';
import {
  Marketplace,
  OrderStatus,
  type Order,
  type Prisma,
} from '@prisma/client';

import { PrismaService } from '../../src/prisma/prisma.service';

export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

/** Test e-posta desenine uyan kullanıcıları ve bağlı org verisini temizler. */
export async function cleanupTestUsersByEmail(
  app: INestApplication,
  email: string,
): Promise<void> {
  const prisma = getPrisma(app);
  const normalized = email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: normalized },
    select: { id: true, organizationId: true },
  });
  if (!user?.organizationId) {
    return;
  }
  const organizationId = user.organizationId;

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.product.updateMany({
      where: { organizationId },
      data: { deletedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() },
    });
  });
}

/** E2E sonrası ürün kayıtlarını soft-delete eder. */
export async function softDeleteProducts(
  app: INestApplication,
  organizationId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) {
    return;
  }
  const prisma = getPrisma(app);
  await prisma.product.updateMany({
    where: { organizationId, id: { in: productIds } },
    data: { deletedAt: new Date() },
  });
}

export async function lockUserAccount(
  app: INestApplication,
  email: string,
  minutes = 15,
): Promise<void> {
  const prisma = getPrisma(app);
  const lockedUntil = new Date();
  lockedUntil.setMinutes(lockedUntil.getMinutes() + minutes);
  await prisma.user.updateMany({
    where: { email: email.toLowerCase(), deletedAt: null },
    data: { lockedUntil },
  });
}

export interface CreateTestOrderInput {
  organizationId: string;
  platform?: Marketplace;
  status?: OrderStatus;
  customerName?: string;
  totalAmount?: number;
  platformOrderId?: string;
  items?: Array<{
    sku: string;
    barcode: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
}

export async function createTestOrder(
  app: INestApplication,
  input: CreateTestOrderInput,
): Promise<Order> {
  const prisma = getPrisma(app);
  const platformOrderId =
    input.platformOrderId ?? `PO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const orderData: Prisma.OrderCreateInput = {
    organization: { connect: { id: input.organizationId } },
    platform: input.platform ?? Marketplace.TRENDYOL,
    platformOrderId,
    status: input.status ?? OrderStatus.NEW,
    customerName: input.customerName ?? 'E2E Müşteri',
    customerPhone: '+905551112233',
    shippingAddress: 'Test Mah. Test Sok. No:1 İstanbul',
    totalAmount: input.totalAmount ?? 199.99,
    platformCreatedAt: new Date(),
    items: {
      create:
        input.items?.map((item) => ({
          organizationId: input.organizationId,
          sku: item.sku,
          barcode: item.barcode,
          productName: item.productName ?? 'Test Ürün',
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice ?? 199.99,
        })) ?? [
          {
            organizationId: input.organizationId,
            sku: 'SKU-E2E-001',
            barcode: '8690000000001',
            productName: 'Test Ürün',
            quantity: 1,
            unitPrice: 199.99,
          },
        ],
    },
  };

  return prisma.order.create({ data: orderData });
}
