import { useMemo, useState, type ReactElement } from 'react';

import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SyncLogItem } from '@/components/SyncLogItem';
import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

function logKey(log: { syncedAt: string; message: string }, idx: number): string {
  return `${log.syncedAt}::${idx}::${log.message}`;
}

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
    <div className="stackLg">
      <div>
        <h1 className="h2">Durum</h1>
        <p className="muted">Bulut bağlantısı ve hızlı senkronizasyon kontrolleri.</p>
      </div>

      <div className="row">
        <div className="pill">
          <span className={`dot ${connected ? 'dotOk' : 'dotBad'}`} />
          <span style={{ fontWeight: 650 }}>{connected ? 'Bağlı' : 'Bağlantı Yok'}</span>
        </div>
        <div style={{ fontSize: 13, color: '#334155' }}>
          <span style={{ fontWeight: 650 }}>Organizasyon:</span> {token?.orgName ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: '#334155' }}>
          <span style={{ fontWeight: 650 }}>Son senkron:</span> {lastSyncAt ?? '—'}
        </div>
      </div>

      <ConnectionStatus health={health} />

      <div className="panel">
        <p className="h2">Şimdi Sync Et</p>
        <div className="gridActions" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void runSync('TRENDYOL', 'Trendyol')}
            className="btn btnGhost"
          >
            Trendyol
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void runSync('HEPSIBURADA', 'Hepsiburada')}
            className="btn btnGhost"
          >
            Hepsiburada
          </button>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          disabled={!token || busy}
          onClick={() => void refreshHealth()}
          className="btn btnAccent"
        >
          Sağlık Kontrolü
        </button>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div className="panel">
        <p className="h2">Son 5 Senkron Logu</p>
        <div className="stack" style={{ marginTop: 12 }}>
          {syncLogs.slice(0, 5).map((log, idx) => (
            <SyncLogItem key={logKey(log, idx)} log={log} platformLabel="Senkron" />
          ))}
          {syncLogs.length === 0 ? <p className="muted" style={{ margin: 0 }}>Henüz log yok.</p> : null}
        </div>
      </div>

      <p className="small">Sürüm: {health?.version ?? '—'}</p>
    </div>
  );
}
