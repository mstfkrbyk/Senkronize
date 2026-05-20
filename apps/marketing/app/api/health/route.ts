import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/api-base-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type BasicHealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  services: { database: 'up' | 'down' };
};

export type DetailedHealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  db: { status: 'up' | 'down' | 'degraded'; latencyMs?: number; message?: string };
  redis: { status: 'up' | 'down' | 'degraded'; latencyMs?: number; message?: string };
  queues: {
    name: string;
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    status: 'up' | 'degraded' | 'down';
  }[];
  adapters: {
    platform: string;
    status: 'up' | 'down';
    latencyMs?: number;
  }[];
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers?: number;
  };
};

export async function GET(): Promise<
  NextResponse<DetailedHealthPayload | { error: string }>
> {
  const base = getApiBaseUrl();
  const target = `${base}/api/v1/health/detailed`;
  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const fallback = `${base}/api/v1/health`;
      const basicRes = await fetch(fallback, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!basicRes.ok) {
        return NextResponse.json(
          { error: `Sağlık uç noktası ${res.status} döndü` },
          { status: 502 },
        );
      }
      const basic = (await basicRes.json()) as BasicHealthPayload;
      const mapped: DetailedHealthPayload = {
        status: basic.status,
        timestamp: basic.timestamp,
        version: basic.version,
        db: {
          status: basic.services.database === 'up' ? 'up' : 'down',
        },
        redis: { status: 'degraded', message: 'Detaylı uç nokta kullanılamadı' },
        queues: [],
        adapters: [],
        uptime: 0,
        memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      };
      return NextResponse.json(mapped);
    }
    const body = (await res.json()) as DetailedHealthPayload;
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: 'Sağlık uç noktasına ulaşılamadı' },
      { status: 503 },
    );
  }
}
