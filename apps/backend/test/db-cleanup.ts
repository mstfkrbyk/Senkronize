import { PrismaClient } from '@prisma/client';

import { getTestDatabaseUrl } from './test-env';

let prisma: PrismaClient | null = null;

function getCleanupClient(): PrismaClient {
  if (!prisma) {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function truncateAllTables(): Promise<void> {
  const client = getCleanupClient();
  const rows = await client.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) {
    return;
  }

  const tableList = rows.map((r) => `"${r.tablename}"`).join(', ');
  await client.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
}
