import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { mockOrgContextLineFromEnv } from '@/lib/mock-org-config';
import { runFullPlatformSync } from '@/lib/run-platform-sync';
import { tauriApi, type SyncStatusResponse } from '@/lib/tauri';

const INTERVAL_OPTIONS = [5, 15, 30, 60] as const;

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

const orgContextPreview = mockOrgContextLineFromEnv();

export function TraySettings(): ReactElement {
  const [intervalMinutes, setIntervalMinutes] = useState<number>(15);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const s = await tauriApi.getSyncStatus();
      setStatus(s);
      setAutoEnabled(s.isRunning);
      setIntervalMinutes(s.intervalMinutes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void (async () => {
      unlisten = await listen('sync-status-changed', () => {
        void refreshStatus();
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [refreshStatus]);

  async function onToggleAuto(next: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (next) {
        await tauriApi.startAutoSync(intervalMinutes);
      } else {
        await tauriApi.stopAutoSync();
      }
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onIntervalChange(next: number): Promise<void> {
    setIntervalMinutes(next);
    if (!autoEnabled) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await tauriApi.stopAutoSync();
      await tauriApi.startAutoSync(next);
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onSyncNow(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await runFullPlatformSync();
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <p className="h2">Tray ve otomatik senkron</p>
      <p className="muted" style={{ marginTop: 8 }}>
        Arka planda periyodik senkron ve hızlı tetikleme.
      </p>

      {orgContextPreview ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontWeight: 650 }}>Org özeti (geliştirme)</p>
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
            {orgContextPreview}
          </p>
        </div>
      ) : null}

      <div className="flexBetween" style={{ marginTop: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 650 }}>Otomatik senkron</p>
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
            Açıkken seçilen aralıkta bulut senkronu tetiklenir.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoEnabled}
          disabled={busy}
          onClick={() => void onToggleAuto(!autoEnabled)}
          className={`toggle ${autoEnabled ? 'toggleOn' : 'toggleOff'}`}
        >
          <span className={`knob ${autoEnabled ? 'knobOn' : ''}`} />
        </button>
      </div>

      <label className="fieldLabel" htmlFor="autoSyncInterval" style={{ marginTop: 16 }}>
        Senkron aralığı (dakika)
      </label>
      <select
        id="autoSyncInterval"
        className="select"
        disabled={busy}
        value={intervalMinutes}
        onChange={(e) => void onIntervalChange(Number(e.target.value))}
      >
        {INTERVAL_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m} dakika
          </option>
        ))}
      </select>

      <div style={{ marginTop: 16 }}>
        <p style={{ margin: 0, fontWeight: 650 }}>Son senkron (tray)</p>
        <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
          {formatLastSync(status?.lastSync)}
        </p>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSyncNow()}
          className="btn btnAccent"
        >
          Şimdi Sync Et
        </button>
      </div>

      {error ? <div className="alert" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
