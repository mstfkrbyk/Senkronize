import { execSync } from 'node:child_process';

const DEFAULT_TEST_DB = 'senkronize_test';

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
