import { PrismaClient, OrgType, PlanTier, SubStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PLATFORM_ORG_SLUG = 'senkronize-platform';

async function main(): Promise<void> {
  const emailRaw = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!emailRaw || !password) {
    console.log(
      'SEED_SUPER_ADMIN_EMAIL ve SEED_SUPER_ADMIN_PASSWORD tanımlı değil; seed atlandı.',
    );
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: emailRaw, deletedAt: null },
  });
  if (existingUser) {
    console.log('Super admin seed: kullanıcı zaten var, atlanıyor.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);

  await prisma.$transaction(async (tx) => {
    let org = await tx.organization.findFirst({
      where: { slug: PLATFORM_ORG_SLUG, deletedAt: null },
    });
    if (!org) {
      org = await tx.organization.create({
        data: {
          slug: PLATFORM_ORG_SLUG,
          name: 'Senkronize Platform',
          type: OrgType.DIRECT,
          onboardingCompleted: true,
        },
      });
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: PlanTier.KURUMSAL,
          status: SubStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await tx.user.create({
      data: {
        organizationId: org.id,
        email: emailRaw,
        name: 'Platform Süper Admin',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
      },
    });
  });

  console.log('Super admin kullanıcı oluşturuldu:', emailRaw);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
