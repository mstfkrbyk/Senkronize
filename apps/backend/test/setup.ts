import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BillingPeriod,
  OrgType,
  PlanTier,
  SubStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

import { getTestDatabaseUrl } from './test-env';
export { getTestDatabaseUrl, ensureTestDatabase } from './test-env';
export { truncateAllTables } from './db-cleanup';

let sharedPrisma: PrismaService | null = null;

export async function getPrismaClient(): Promise<PrismaService> {
  if (sharedPrisma) {
    return sharedPrisma;
  }
  process.env.DATABASE_URL = getTestDatabaseUrl();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const prisma = moduleRef.get(PrismaService);
  sharedPrisma = prisma;
  return prisma;
}

export interface TestSeedResult {
  organizationId: string;
  userId: string;
  email: string;
  password: string;
  subscriptionId: string;
}

/** Test organizasyonu, kullanıcı ve abonelik kaydı oluşturur. */
export async function seedTestData(
  overrides: Partial<{ email: string; password: string; plan: PlanTier }> = {},
): Promise<TestSeedResult> {
  process.env.DATABASE_URL = getTestDatabaseUrl();
  const prisma = new PrismaClient();
  const suffix = Date.now().toString().slice(-8);
  const email = (overrides.email ?? `seed-${suffix}@senkronize.test`).toLowerCase();
  const password = overrides.password ?? 'TestPassword123!';
  const plan = overrides.plan ?? PlanTier.GELISIM;
  const passwordHash = await bcrypt.hash(password, 10);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const org = await prisma.organization.create({
    data: {
      name: 'E2E Test Org',
      slug: `e2e-test-${suffix}`,
      type: OrgType.DIRECT,
      taxNumber: `9${suffix}`.padStart(10, '0').slice(0, 10),
      taxOffice: 'Kadıköy',
      address: 'Test adres',
      city: 'İstanbul',
      subscription: {
        create: {
          plan,
          status: SubStatus.TRIAL,
          billingPeriod: BillingPeriod.YEARLY,
          trialEndsAt,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          marketplaceLimit: 10,
          monthlyOrderLimit: 5000,
          userLimit: 5,
          erpLimit: 3,
          ecommerceLimit: 5,
        },
      },
    },
    include: { subscription: true },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'E2E Seed User',
      phone: '+905551112233',
      role: UserRole.OWNER,
      organizationId: org.id,
    },
  });

  await prisma.$disconnect();

  if (!org.subscription) {
    throw new Error('Seed abonelik oluşturulamadı');
  }

  return {
    organizationId: org.id,
    userId: user.id,
    email,
    password,
    subscriptionId: org.subscription.id,
  };
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  httpServer: ReturnType<INestApplication['getHttpServer']>;
}> {
  process.env.DATABASE_URL = getTestDatabaseUrl();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  return { app, httpServer: app.getHttpServer() };
}
