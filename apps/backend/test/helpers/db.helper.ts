import type { INestApplication } from '@nestjs/common';

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
  if (!user) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.product.updateMany({
      where: { organizationId: user.organizationId },
      data: { deletedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    await tx.organization.update({
      where: { id: user.organizationId },
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
