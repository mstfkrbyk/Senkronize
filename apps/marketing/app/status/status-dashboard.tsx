'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import type { DetailedHealthPayload } from '@/app/api/health/route';

type RowState = 'operational' | 'degraded' | 'outage' | 'unknown';

function serviceState(
  status: 'up' | 'down' | 'degraded' | undefined,
): RowState {
  if (!status) return 'unknown';
  if (status === 'up') return 'operational';
  if (status === 'degraded') return 'degraded';
  return 'outage';
}

function StatusDot({ state }: { state: RowState }): ReactElement {
  const map: Record<RowState, string> = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    outage: 'bg-red-500',
    unknown: 'bg-slate-400',
  };
  const label: Record<RowState, string> = {
    operational: 'Çalışıyor',
    degraded: 'Kısıtlı',
    outage: 'Kesinti',
    unknown: 'Bilinmiyor',
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${map[state]}`}
        aria-hidden
      />
      <span className="text-sm font-medium text-[#111827]">{label[state]}</span>
    </span>
  );
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) {
    return `${days} gün ${hours} saat`;
  }
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours} saat ${mins} dk`;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function StatusDashboard(): ReactElement {
  const [data, setData] = useState<DetailedHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        setData(null);
        return;
      }
      const json = (await res.json()) as DetailedHealthPayload;
      setData(json);
    } catch {
      setError('Ağ hatası');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const fetchFailed = Boolean(error);
  const apiState: RowState = fetchFailed
    ? 'outage'
    : data?.status === 'ok'
      ? 'operational'
      : data
        ? 'degraded'
        : 'unknown';

  const rows: { name: string; state: RowState; detail: string }[] = [
    {
      name: 'API',
      state: apiState,
      detail: loading
        ? 'Kontrol ediliyor…'
        : data
          ? `Sürüm ${data.version} · ${new Date(data.timestamp).toLocaleString('tr-TR')}`
          : (error ?? 'Yanıt yok'),
    },
    {
      name: 'Veritabanı',
      state: fetchFailed ? 'unknown' : serviceState(data?.db.status),
      detail: data?.db.latencyMs
        ? `PostgreSQL · ${data.db.latencyMs} ms`
        : data?.db.message ?? (data ? 'PostgreSQL bağlantısı' : 'Okunamadı'),
    },
    {
      name: 'Redis',
      state: fetchFailed ? 'unknown' : serviceState(data?.redis.status),
      detail: data?.redis.latencyMs
        ? `Redis · ${data.redis.latencyMs} ms`
        : (data?.redis.message ?? (data ? 'Önbellek / kuyruk' : 'Okunamadı')),
    },
    ...(data?.adapters ?? []).map((a) => ({
      name: `${a.platform} API`,
      state: (a.status === 'up' ? 'operational' : 'outage') as RowState,
      detail: a.latencyMs ? `Ping · ${a.latencyMs} ms` : 'Pazaryeri uç noktası',
    })),
    {
      name: 'Panel',
      state: 'operational' as RowState,
      detail: 'panel.senkronize.com',
    },
    {
      name: 'Marketing sitesi',
      state: 'operational' as RowState,
      detail: 'Bu sayfa üzerinden erişilebilir',
    },
  ];

  const degradedQueues =
    data?.queues.filter((q) => q.status !== 'up').length ?? 0;
  const totalBacklog =
    data?.queues.reduce((s, q) => s + q.waiting + q.delayed, 0) ?? 0;

  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">
              Genel durum
            </h2>
            <p className="text-sm text-muted-foreground">
              Canlı veri{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                GET /api/v1/health/detailed
              </code>{' '}
              üzerinden güncellenir (30 sn yenileme).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-border bg-slate-50 px-4 py-2 text-sm font-medium text-[#111827] transition hover:bg-slate-100"
          >
            Yenile
          </button>
        </div>
        {data ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Çalışma süresi</dt>
              <dd className="font-semibold text-[#111827]">
                {formatUptime(data.uptime)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bellek (heap)</dt>
              <dd className="font-semibold text-[#111827]">
                {formatMb(data.memory.heapUsed)} /{' '}
                {formatMb(data.memory.heapTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kuyruk birikimi</dt>
              <dd className="font-semibold text-[#111827]">
                {totalBacklog.toLocaleString('tr-TR')} bekleyen
                {degradedQueues > 0
                  ? ` · ${degradedQueues} kuyruk kısıtlı`
                  : ''}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-[#111827]">Bileşen</th>
              <th className="px-6 py-3 font-semibold text-[#111827]">Durum</th>
              <th className="hidden px-6 py-3 font-semibold text-[#111827] md:table-cell">
                Açıklama
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-6 py-4 font-medium text-[#111827]">{row.name}</td>
                <td className="px-6 py-4">
                  <StatusDot state={row.state} />
                </td>
                <td className="hidden max-w-xl px-6 py-4 text-muted-foreground md:table-cell">
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.queues.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border bg-slate-50 px-6 py-3">
            <h2 className="text-lg font-semibold text-[#111827]">
              BullMQ kuyrukları
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-6 py-2 font-medium">Kuyruk</th>
                <th className="px-6 py-2 font-medium text-right">Bekleyen</th>
                <th className="px-6 py-2 font-medium text-right">Aktif</th>
                <th className="px-6 py-2 font-medium text-right">Başarısız</th>
                <th className="px-6 py-2 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.name} className="border-b border-border last:border-0">
                  <td className="px-6 py-3 font-mono text-xs">{q.name}</td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {q.waiting + q.delayed}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{q.active}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{q.failed}</td>
                  <td className="px-6 py-3">
                    <StatusDot state={serviceState(q.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
