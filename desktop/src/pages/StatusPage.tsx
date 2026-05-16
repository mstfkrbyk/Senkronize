import { useMemo, useState, type ReactElement } from 'react';

import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SyncLogItem } from '@/components/SyncLogItem';
import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

export function StatusPage(): ReactElement {
  const token = useAppStore((s) => s.token);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const localErpBaseUrl = useAppStore((s) => s.localErpBaseUrl);
  const health = useAppStore((s) => s.health);
  const syncLogs = useAppStore((s) => s.syncLogs);
  const setHealth = useAppStore((s) => s.setHealth);
  const addSyncLog = useAppStore((s) => s.addSyncLog);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = health?.cloudConnected === true;

  const lastSyncAt = useMemo(() => {
    const first = syncLogs.find((l) => l.success);
    return first?.syncedAt ?? health?.lastSyncAt ?? null;
  }, [health?.lastSyncAt, syncLogs]);

  async function refreshHealth(): Promise<void> {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const next = await tauriApi.checkHealth(
        apiUrl,
        token.token,
        localErpBaseUrl.trim() ? localErpBaseUrl.trim() : null,
      );
      setHealth(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function runSync(platform: string, label: string): Promise<void> {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tauriApi.triggerSync(apiUrl, token.token, platform);
      addSyncLog({ ...res, message: `${label}: ${res.message}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Durum</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bulut bağlantısı ve hızlı senkronizasyon kontrolleri.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <span className="font-medium">{connected ? 'Bağlı' : 'Bağlantı Yok'}</span>
        </div>
        <div className="text-sm text-slate-700">
          <span className="font-medium">Organizasyon:</span>{' '}
          <span>{token?.orgName ?? '—'}</span>
        </div>
        <div className="text-sm text-slate-700">
          <span className="font-medium">Son senkron:</span>{' '}
          <span>{lastSyncAt ?? '—'}</span>
        </div>
      </div>

      <ConnectionStatus health={health} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Şimdi Sync Et</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void runSync('TRENDYOL', 'Trendyol')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trendyol
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void runSync('HEPSIBURADA', 'Hepsiburada')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hepsiburada
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!token || busy}
          onClick={() => void refreshHealth()}
          className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sağlık Kontrolü
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Son 5 Senkron Logu</p>
        <div className="mt-3 space-y-2">
          {syncLogs.slice(0, 5).map((log, idx) => (
            <SyncLogItem
              // eslint-disable-next-line react/no-array-index-key -- log list has no stable id
              key={`${log.syncedAt}-${idx}`}
              log={log}
              platformLabel="Senkron"
            />
          ))}
          {syncLogs.length === 0 ? (
            <p className="text-sm text-slate-600">Henüz log yok.</p>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-slate-500">Sürüm: {health?.version ?? '—'}</p>
    </div>
  );
}
