'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

type HealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  services: { database: 'up' | 'down' };
};

type RowState = 'operational' | 'degraded' | 'outage' | 'unknown';

function rowFromHealth(
  key: 'api' | 'database',
  payload: HealthPayload | null,
  fetchError: boolean,
): RowState {
  if (fetchError || !payload) {
    return key === 'api' ? 'outage' : 'unknown';
  }
  if (key === 'api') {
    return payload.status === 'ok' ? 'operational' : 'degraded';
  }
  return payload.services.database === 'up' ? 'operational' : 'outage';
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

/** Yer tutucu: gerçek uptime verisi ayrı izleme sisteminden beslenecek. */
const UPTIME_PLACEHOLDER = '99,97%';

const BAR_PATTERN: { h: number; tone: 'ok' | 'warn' | 'bad' }[] = Array.from(
  { length: 90 },
  (_, i) => {
    const cycle = Math.sin(i / 4.2) * 0.35 + 0.65;
    const h = Math.round(28 + cycle * 52);
    if (i === 41 || i === 72) {
      return { h: 36, tone: 'warn' as const };
    }
    if (i === 58) {
      return { h: 22, tone: 'bad' as const };
    }
    return { h, tone: 'ok' as const };
  },
);

export function StatusDashboard(): ReactElement {
  const [data, setData] = useState<HealthPayload | null>(null);
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
      const json = (await res.json()) as HealthPayload;
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
  const apiState = rowFromHealth('api', data, fetchFailed);
  const dbState = rowFromHealth('database', data, fetchFailed);

  const rows: { name: string; state: RowState; detail: string }[] = [
    {
      name: 'API',
      state: apiState,
      detail: loading
        ? 'Kontrol ediliyor…'
        : data
          ? `Sürüm ${data.version} · ${new Date(data.timestamp).toLocaleString('tr-TR')}`
          : error ?? 'Yanıt yok',
    },
    {
      name: 'Veritabanı',
      state: dbState,
      detail:
        data?.services.database === 'up'
          ? 'PostgreSQL bağlantısı başarılı'
          : data
            ? 'Bağlantı sorunu (degraded)'
            : 'Sağlık uç noktasından okunamadı',
    },
    {
      name: 'Redis',
      state: 'unknown',
      detail: 'Ayrı metrik; yakında eklenecek (tahmini operasyonel)',
    },
    {
      name: 'Panel',
      state: 'operational',
      detail: 'Yer tutucu — panel izleme entegrasyonu sonrası güncellenecek',
    },
    {
      name: 'Marketing sitesi',
      state: 'operational',
      detail: 'Bu sayfa üzerinden erişilebilirlik varsayımı',
    },
  ];

  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">
              Genel durum
            </h2>
            <p className="text-sm text-muted-foreground">
              API ve veritabanı{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                GET /api/v1/health
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
        <p className="mt-4 text-sm text-muted-foreground">
          Tahmini uptime (son 90 gün, yer tutucu):{' '}
          <span className="font-semibold text-[#111827]">{UPTIME_PLACEHOLDER}</span>
        </p>
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

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#111827]">
          Son 90 gün (özet çubukları)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Yeşil: sorunsuz · Sarı: gecikme / kısıtlı · Kırmızı: kesinti. Görsel yer
          tutucudur; üretimde gerçek incident verisi ile değiştirilecektir.
        </p>
        <div
          className="mt-6 flex h-24 items-end gap-px overflow-x-auto pb-1"
          role="img"
          aria-label="Son 90 gün için örnek durum çubukları"
        >
          {BAR_PATTERN.map((b, i) => {
            const bg =
              b.tone === 'ok'
                ? 'bg-emerald-500/90'
                : b.tone === 'warn'
                  ? 'bg-amber-400'
                  : 'bg-red-500';
            return (
              <div
                key={i}
                className={`w-1 shrink-0 rounded-t ${bg}`}
                style={{ height: `${b.h}%` }}
                title={`Gün ${i + 1}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
