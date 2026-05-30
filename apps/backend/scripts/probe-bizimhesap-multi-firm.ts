/**
 * BizimHesap çoklu şirket / tek istek denemesi.
 * Token değerleri stdout'a yazılmaz.
 */
import { createDecipheriv } from 'crypto';

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const BIZIMHESAP_BASE_URL = 'https://bizimhesap.com/api/b2b';
const BIZIMHESAP_FIXED_KEY = 'BZMHB2B724018943908D0B82491F203F';

function decrypt(ciphertext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ciphertext.slice(0, 24), 'hex');
  const authTag = Buffer.from(ciphertext.slice(24, 56), 'hex');
  const encrypted = Buffer.from(ciphertext.slice(56), 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function tokenFingerprint(token: string): string {
  return `${token.slice(0, 4)}…${token.slice(-4)} (${String(token.length)} char)`;
}

function resolveProductsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data || typeof data !== 'object') {
    return [];
  }
  const obj = data as Record<string, unknown>;
  for (const key of ['data', 'Data', 'products', 'Products', 'items', 'Items']) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val;
    }
    if (val && typeof val === 'object') {
      return Object.values(val as Record<string, unknown>);
    }
  }
  return Object.values(obj);
}

function sampleIds(rows: unknown[]): string[] {
  return rows
    .slice(0, 3)
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return '';
      }
      const r = row as Record<string, unknown>;
      return String(r.Id ?? r.id ?? r.productId ?? r.ProductId ?? '').trim();
    })
    .filter(Boolean);
}

async function fetchProducts(
  label: string,
  token: string,
  extra?: { params?: Record<string, string>; headers?: Record<string, string> },
): Promise<{ label: string; ok: boolean; status: number; count: number; sampleIds: string[]; error?: string }> {
  try {
    const response = await axios.get<unknown>(`${BIZIMHESAP_BASE_URL}/products`, {
      headers: {
        Key: BIZIMHESAP_FIXED_KEY,
        Token: token,
        Accept: 'application/json',
        ...(extra?.headers ?? {}),
      },
      params: extra?.params,
      timeout: 30_000,
      validateStatus: () => true,
    });
    const rows = resolveProductsArray(response.data);
    return {
      label,
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      count: rows.length,
      sampleIds: sampleIds(rows),
      error:
        response.status >= 400
          ? typeof response.data === 'string'
            ? response.data.slice(0, 120)
            : JSON.stringify(response.data).slice(0, 120)
          : undefined,
    };
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      count: 0,
      sampleIds: [],
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

async function main(): Promise<void> {
  const hexKey = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('ENCRYPTION_KEY missing');
  }

  const prisma = new PrismaClient();
  const connections = await prisma.erpConnection.findMany({
    where: {
      erpType: 'BIZIMHESAP',
      deletedAt: null,
      isActive: true,
      organization: { name: { contains: 'MIX ELEKTRİK' } },
    },
    select: {
      id: true,
      displayName: true,
      role: true,
      credentialsEnc: true,
    },
    orderBy: { role: 'asc' },
  });

  if (connections.length < 2) {
    console.log('Need at least 2 BizimHesap connections; found', connections.length);
    await prisma.$disconnect();
    return;
  }

  const creds = connections.map((c) => {
    const json = JSON.parse(decrypt(c.credentialsEnc, hexKey)) as Record<string, string>;
    const token = (json.token ?? json.apiKey ?? json.firmId ?? '').trim();
    return {
      id: c.id,
      role: c.role,
      displayName: c.displayName,
      token,
    };
  });

  console.log('Connections:');
  for (const c of creds) {
    console.log(
      `  - ${c.role} ${c.displayName ?? c.id}: token ${tokenFingerprint(c.token)}`,
    );
  }
  console.log(
    'Same token?',
    creds[0].token === creds[1].token ? 'YES (duplicate credential)' : 'NO (different tokens)',
  );

  const [primary, secondary] = creds;
  const attempts: Array<Promise<{ label: string; ok: boolean; status: number; count: number; sampleIds: string[]; error?: string }>> = [
    fetchProducts('A: PRIMARY token alone', primary.token),
    fetchProducts('B: SECONDARY token alone', secondary.token),
    fetchProducts('C: PRIMARY + ?firmId=secondary', primary.token, {
      params: { firmId: secondary.token },
    }),
    fetchProducts('D: PRIMARY + ?firmId=primary', primary.token, {
      params: { firmId: primary.token },
    }),
    fetchProducts('E: POST /products body {firmIds:[both]}', primary.token, {
      headers: { 'Content-Type': 'application/json' },
    }),
  ];

  // Try POST with firmIds array (unlikely but user asked to try)
  attempts.push(
    (async () => {
      try {
        const response = await axios.post<unknown>(
          `${BIZIMHESAP_BASE_URL}/products`,
          { firmIds: [primary.token, secondary.token] },
          {
            headers: {
              Key: BIZIMHESAP_FIXED_KEY,
              Token: primary.token,
              Accept: 'application/json',
            },
            timeout: 30_000,
            validateStatus: () => true,
          },
        );
        const rows = resolveProductsArray(response.data);
        return {
          label: 'F: POST /products {firmIds:[both]}',
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          count: rows.length,
          sampleIds: sampleIds(rows),
          error:
            response.status >= 400
              ? JSON.stringify(response.data).slice(0, 120)
              : undefined,
        };
      } catch (error) {
        return {
          label: 'F: POST /products {firmIds:[both]}',
          ok: false,
          status: 0,
          count: 0,
          sampleIds: [],
          error: error instanceof Error ? error.message : 'unknown',
        };
      }
    })(),
  );

  // Try alternate endpoints that might list all firms
  for (const path of ['/firms', '/companies', '/accounts']) {
    attempts.push(
      (async () => {
        try {
          const response = await axios.get<unknown>(`${BIZIMHESAP_BASE_URL}${path}`, {
            headers: {
              Key: BIZIMHESAP_FIXED_KEY,
              Token: primary.token,
              Accept: 'application/json',
            },
            timeout: 15_000,
            validateStatus: () => true,
          });
          const rows = resolveProductsArray(response.data);
          return {
            label: `G: GET ${path} (primary token)`,
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            count: rows.length,
            sampleIds: sampleIds(rows),
            error:
              response.status >= 400
                ? JSON.stringify(response.data).slice(0, 80)
                : undefined,
          };
        } catch (error) {
          return {
            label: `G: GET ${path} (primary token)`,
            ok: false,
            status: 0,
            count: 0,
            sampleIds: [],
            error: error instanceof Error ? error.message : 'unknown',
          };
        }
      })(),
    );
  }

  const results = await Promise.all(attempts);
  console.log('\nResults:');
  for (const r of results) {
    console.log(
      `${r.ok ? 'OK' : 'FAIL'} [${r.status}] ${r.label} → count=${String(r.count)} samples=${r.sampleIds.join(',') || '-'}${r.error ? ` err=${r.error}` : ''}`,
    );
  }

  const a = results.find((r) => r.label.startsWith('A:'));
  const b = results.find((r) => r.label.startsWith('B:'));
  if (a && b && a.ok && b.ok) {
    console.log('\nOverlap check (A vs B sample ids):');
    const overlap = a.sampleIds.filter((id) => b.sampleIds.includes(id));
    console.log('  overlapping samples:', overlap.length > 0 ? overlap.join(',') : 'none');
    console.log('  counts:', `primary=${String(a.count)} secondary=${String(b.count)}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
