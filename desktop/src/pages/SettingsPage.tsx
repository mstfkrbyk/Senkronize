import { useState, type ReactElement } from 'react';

import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

type SyncInterval = 'manual' | '15m' | '30m' | '1h';

export interface SettingsPageProps {
  onResetSession: () => void;
}

export function SettingsPage({ onResetSession }: SettingsPageProps): ReactElement {
  const apiUrl = useAppStore((s) => s.apiUrl);
  const localErpBaseUrl = useAppStore((s) => s.localErpBaseUrl);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const setLocalErpBaseUrl = useAppStore((s) => s.setLocalErpBaseUrl);

  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [syncInterval, setSyncInterval] = useState<SyncInterval>('manual');
  const [erpTestMessage, setErpTestMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onTestErp(): Promise<void> {
    setBusy(true);
    setErpTestMessage(null);
    try {
      const res = await tauriApi.testLocalErpConnection(localErpBaseUrl.trim());
      setErpTestMessage(res.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErpTestMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function onResetToken(): Promise<void> {
    setBusy(true);
    try {
      await tauriApi.clearToken();
      onResetSession();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">Ayarlar</h1>
        <p className="muted">Bağlantı ve yerel çalışma tercihleri.</p>
      </div>

      <div className="panel">
        <label className="fieldLabel" htmlFor="settingsApiUrl">
          API URL
        </label>
        <input
          id="settingsApiUrl"
          className="input"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="panel">
        <label className="fieldLabel" htmlFor="localErpUrl">
          Yerel ERP tabanı (HTTP)
        </label>
        <input
          id="localErpUrl"
          className="input"
          value={localErpBaseUrl}
          onChange={(e) => setLocalErpBaseUrl(e.target.value)}
          placeholder="http://192.168.1.10:8080"
          autoComplete="off"
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={busy || localErpBaseUrl.trim().length === 0}
            onClick={() => void onTestErp()}
            className="btn btnGhost"
          >
            Bağlantıyı Test Et
          </button>
          {erpTestMessage ? (
            <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>{erpTestMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="flexBetween">
          <div>
            <p className="h2">Başlangıçta otomatik başlat</p>
            <p className="muted" style={{ marginTop: 8 }}>
              Şimdilik yalnızca arayüzde tutulur (işletim sistemi entegrasyonu sonraya bırakıldı).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={launchOnStartup}
            onClick={() => setLaunchOnStartup((v) => !v)}
            className={`toggle ${launchOnStartup ? 'toggleOn' : 'toggleOff'}`}
          >
            <span className={`knob ${launchOnStartup ? 'knobOn' : ''}`} />
          </button>
        </div>
      </div>

      <div className="panel">
        <p className="h2">Sync aralığı</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Şimdilik yalnızca planlama arayüzü; zamanlayıcı entegrasyonu sonraki adım.
        </p>
        <select
          className="select"
          value={syncInterval}
          onChange={(e) => setSyncInterval(e.target.value as SyncInterval)}
        >
          <option value="manual">El ile</option>
          <option value="15m">15 dakika</option>
          <option value="30m">30 dakika</option>
          <option value="1h">1 saat</option>
        </select>
      </div>

      <div className="dangerPanel">
        <p className="h2" style={{ color: '#7f1d1d' }}>
          Oturumu sıfırla
        </p>
        <p className="muted" style={{ marginTop: 8, color: '#7f1d1d' }}>
          Anahtar zincirindeki token silinir ve kurulum ekranına dönersiniz.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onResetToken()}
          className="btn btnDanger"
          style={{ marginTop: 12 }}
        >
          Tokenı Sıfırla
        </button>
      </div>
    </div>
  );
}
