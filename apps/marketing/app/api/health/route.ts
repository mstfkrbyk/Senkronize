import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/api-base-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  services: { database: 'up' | 'down' };
};

export async function GET(): Promise<NextResponse<HealthPayload | { error: string }>> {
  const base = getApiBaseUrl();
  const target = `${base}/api/v1/health`;
  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Sağlık uç noktası ${res.status} döndü` },
        { status: 502 },
      );
    }
    const body = (await res.json()) as HealthPayload;
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: 'Sağlık uç noktasına ulaşılamadı' },
      { status: 503 },
    );
  }
}
