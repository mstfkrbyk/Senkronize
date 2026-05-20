import { execSync } from 'node:child_process';
import path from 'node:path';

import { ensureTestDatabase, getTestDatabaseUrl } from './setup';

export default async function globalSetup(): Promise<void> {
  const testUrl = getTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;
  ensureTestDatabase(testUrl);

  const backendRoot = path.join(__dirname, '..');
  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
