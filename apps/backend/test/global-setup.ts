import { execSync } from 'node:child_process';
import path from 'node:path';

import { ensureTestDatabase, getTestDatabaseUrl } from './setup';

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
    // Boş test DB — migration zinciri kırıksa şemayı doğrudan senkronize et
    execSync('npx prisma db push --skip-generate', {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'inherit',
    });
  }
}
