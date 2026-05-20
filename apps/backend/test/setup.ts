import { execSync } from 'node:child_process';
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

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFAULT_TEST_DB = 'senkronize_test';

let sharedPrisma: PrismaService | null = null;

export function getTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL veya TEST_DATABASE_URL tanımlı olmalıdır');
  }
  const parsed = new URL(base);
  parsed.pathname = `/${DEFAULT_TEST_DB}`;
  return parsed.toString();
}

export function ensureTestDatabase(testUrl: string): void {
  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  const host = parsed.hostname;
  const port = parsed.port || '5432';
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const env = { ...process.env, PGPASSWORD: password };

  execSync(
    `psql -h ${host} -p ${port} -U ${user} -d postgres -c "DROP DATABASE IF EXISTS \\"${dbName}\\" WITH (FORCE);"`,
    { stdio: 'pipe', env },
  );
  execSync(
    `psql -h ${host} -p ${port} -U ${user} -d postgres -c "CREATE DATABASE \\"${dbName}\\";"`,
    { stdio: 'pipe', env },
  );
}

function pathJoinBackend(): string {
  return `${__dirname}/..`;
}

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

export async function truncateAllTables(): Promise<void> {
  process.env.DATABASE_URL = getTestDatabaseUrl();
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) {
    return;
  }

  const tableList = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
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
  const prisma = await getPrismaClient();
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
