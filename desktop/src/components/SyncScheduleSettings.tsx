import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { requestNotificationPermission, showDesktopNotification } from '@/lib/desktop-notify';
import { runFullPlatformSync } from '@/lib/run-platform-sync';
import {
  computeNextSyncAt,
  loadSyncSettings,
  saveSyncSettings,
  type SyncIntervalOption,
  type SyncSettings,
} from '@/lib/sync-settings-store';
import { tauriApi, type SyncStatusResponse } from '@/lib/tauri';

const INTERVAL_OPTIONS: { value: SyncIntervalOption; label: string }[] = [
  { value: 5, label: 'Her 5 dakika' },
  { value: 15, label: 'Her 15 dakika' },
  { value: 30, label: 'Her 30 dakika' },
  { value: 60, label: 'Her 1 saat' },
  { value: null, label: 'Manuel' },
];

function formatTs(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SyncScheduleSettings(): ReactElement {
  const [settings, setSettings] = useState<SyncSettings>(() => loadSyncSettings());
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((next: SyncSettings): void => {
    setSettings(next);
    saveSyncSettings(next);
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const s = await tauriApi.getSyncStatus();
      setStatus(s);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void requestNotificationPermission();
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

  useEffect(() => {
    if (settings.dailySummaryHour === null) {
      return;
    }
    const id = window.setInterval(() => {
      const now = new Date();
      if (now.getHours() === settings.dailySummaryHour && now.getMinutes() === 0) {
        showDesktopNotification(
          'Senkronize günlük özet',
          `Son senkron: ${formatTs(status?.lastSync)}`,
        );
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [settings.dailySummaryHour, status?.lastSync]);

  const nextSyncAt = useMemo(
    () =>
      computeNextSyncAt(
        status?.lastSync ?? null,
        settings.intervalMinutes,
        status?.isRunning === true && settings.intervalMinutes !== null,
      ),
    [settings.intervalMinutes, status?.isRunning, status?.lastSync],
  );

  async function applyScheduler(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await tauriApi.stopAutoSync();
      if (settings.intervalMinutes !== null) {
        await tauriApi.startAutoSync(settings.intervalMinutes);
      }
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
      if (settings.notifyOnComplete) {
        showDesktopNotification('Senkronize', 'Senkron tamamlandı.');
      }
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (settings.notifyOnError) {
        showDesktopNotification('Senkronize', `Senkron hatası: ${message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <p className="h2">Otomatik sync ayarları</p>
      <p className="muted" style={{ marginTop: 8 }}>
        Zamanlama, sync türleri ve bildirim tercihleri.
      </p>

      <label className="fieldLabel" htmlFor="syncInterval" style={{ marginTop: 16 }}>
        Sync sıklığı
      </label>
      <select
        id="syncInterval"
        className="select"
        disabled={busy}
        value={settings.intervalMinutes === null ? 'manual' : String(settings.intervalMinutes)}
        onChange={(e) => {
          const v = e.target.value;
          const minutes: SyncIntervalOption =
            v === 'manual' ? null : (Number(v) as SyncIntervalOption);
          const next = { ...settings, intervalMinutes: minutes };
          persist(next);
          void applyScheduler();
        }}
      >
        {INTERVAL_OPTIONS.map((o) => (
          <option key={o.label} value={o.value === null ? 'manual' : String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>

      <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
        Sonraki sync: {nextSyncAt ? formatTs(nextSyncAt.toISOString()) : 'Manuel / zamanlayıcı kapalı'}
        {status?.isSyncing ? ' · şu an çalışıyor' : ''}
        {status && status.pendingItemCount > 0 ? ` · bekleyen: ${status.pendingItemCount}` : ''}
      </p>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(
          [
            ['syncProduct', 'Ürünler', settings.syncProduct] as const,
            ['syncStock', 'Stok', settings.syncStock] as const,
            ['syncOrder', 'Siparişler', settings.syncOrder] as const,
            ['syncPrice', 'Fiyatlar', settings.syncPrice] as const,
          ] as const
        ).map(([key, label, checked]) => (
          <div key={key} className="flexBetween">
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>{label}</p>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              className={`toggle ${checked ? 'toggleOn' : 'toggleOff'}`}
              onClick={() => persist({ ...settings, [key]: !checked })}
            >
              <span className={`knob ${checked ? 'knobOn' : ''}`} />
            </button>
          </div>
        ))}

        <div className="flexBetween">
          <div>
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Başlangıçta otomatik sync</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Uygulama açıldığında zamanlayıcıyı başlatır
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoSyncOnStartup}
            className={`toggle ${settings.autoSyncOnStartup ? 'toggleOn' : 'toggleOff'}`}
            onClick={() => persist({ ...settings, autoSyncOnStartup: !settings.autoSyncOnStartup })}
          >
            <span className={`knob ${settings.autoSyncOnStartup ? 'knobOn' : ''}`} />
          </button>
        </div>

        <div className="flexBetween">
          <div>
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Sadece değişenler</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Delta sync (tam senkron yerine)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.deltaOnly}
            className={`toggle ${settings.deltaOnly ? 'toggleOn' : 'toggleOff'}`}
            onClick={() => persist({ ...settings, deltaOnly: !settings.deltaOnly })}
          >
            <span className={`knob ${settings.deltaOnly ? 'knobOn' : ''}`} />
          </button>
        </div>
      </div>

      <p className="h2" style={{ marginTop: 24 }}>
        Bildirim ayarları
      </p>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="flexBetween">
          <div>
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Sync tamamlandığında bildirim</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Sistem bildirimi gösterilir
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.notifyOnComplete}
            className={`toggle ${settings.notifyOnComplete ? 'toggleOn' : 'toggleOff'}`}
            onClick={() => persist({ ...settings, notifyOnComplete: !settings.notifyOnComplete })}
          >
            <span className={`knob ${settings.notifyOnComplete ? 'knobOn' : ''}`} />
          </button>
        </div>
        <div className="flexBetween">
          <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Hata durumunda</p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.notifyOnError}
            className={`toggle ${settings.notifyOnError ? 'toggleOn' : 'toggleOff'}`}
            onClick={() => persist({ ...settings, notifyOnError: !settings.notifyOnError })}
          >
            <span className={`knob ${settings.notifyOnError ? 'knobOn' : ''}`} />
          </button>
        </div>
        <label className="fieldLabel" htmlFor="dailySummary">
          Günlük özet saati
        </label>
        <select
          id="dailySummary"
          className="select"
          value={settings.dailySummaryHour === null ? '' : String(settings.dailySummaryHour)}
          onChange={(e) => {
            const v = e.target.value;
            persist({
              ...settings,
              dailySummaryHour: v === '' ? null : Number(v),
            });
          }}
        >
          <option value="">Kapalı</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" disabled={busy} onClick={() => void onSyncNow()} className="btn btnAccent">
          Şimdi Sync Et
        </button>
      </div>

      {error ? <div className="alert" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
