import { execSync } from 'node:child_process';
import path from 'node:path';

import { ensureTestDatabase, getTestDatabaseUrl } from './test-env';

export default async function globalSetup(): Promise<void> {
  const testUrl = getTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;
  ensureTestDatabase(testUrl);

  const backendRoot = path.join(__dirname, '..');

  try {
    execSync('npx prisma migrate deploy', {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'inherit',
    });
  } catch {
    ensureTestDatabase(testUrl);
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'inherit',
    });
  }
}
