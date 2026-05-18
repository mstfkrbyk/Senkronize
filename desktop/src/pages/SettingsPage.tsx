import { useEffect, useState, type ReactElement } from 'react';

import { TraySettings } from '@/components/TraySettings';
import { tauriApi, type UpdateCheckResponse } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

export interface SettingsPageProps {
  onResetSession: () => void;
}

export function SettingsPage({ onResetSession }: SettingsPageProps): ReactElement {
  const apiUrl = useAppStore((s) => s.apiUrl);
  const localErpBaseUrl = useAppStore((s) => s.localErpBaseUrl);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const setLocalErpBaseUrl = useAppStore((s) => s.setLocalErpBaseUrl);

  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResponse | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { isEnabled } = await import('@tauri-apps/plugin-autostart');
        const on = await isEnabled();
        setLaunchOnStartup(on);
      } catch {
        /* Otomatik başlatma API kullanılamıyorsa sessiz */
      }
    })();
  }, []);

  async function onTestErp(): Promise<void> {
    setBusy(true);
    setFeedbackMessage(null);
    try {
      const res = await tauriApi.testLocalErpConnection(localErpBaseUrl.trim());
      setFeedbackMessage(res.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(message);
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

  async function onToggleAutostart(next: boolean): Promise<void> {
    setBusy(true);
    try {
      const { disable, enable } = await import('@tauri-apps/plugin-autostart');
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setLaunchOnStartup(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function onCheckUpdates(): Promise<void> {
    setUpdateBusy(true);
    setUpdateError(null);
    setUpdateResult(null);
    try {
      const res = await tauriApi.checkForUpdates();
      setUpdateResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUpdateError(message);
    } finally {
      setUpdateBusy(false);
    }
  }

  async function openDownload(url: string): Promise<void> {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">Ayarlar</h1>
        <p className="muted">Bağlantı, tray, güncelleme ve yerel çalışma tercihleri.</p>
      </div>

      <div className="panel">
        <label className="fieldLabel" htmlFor="settingsApiUrl">
          Bulut API tabanı (cloud backend URL)
        </label>
        <input
          id="settingsApiUrl"
          className="input"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          autoComplete="off"
        />
        <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Sağlık kontrolü ve senkron istekleri bu adrese gönderilir.
        </p>
      </div>

      <TraySettings />

      <div className="panel">
        <p className="h2">Uygulama güncellemesi</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Sunucudaki sürüm bilgisini kontrol eder (varsayılan: api.senkronize.com).
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={updateBusy}
            onClick={() => void onCheckUpdates()}
            className="btn btnAccent"
          >
            Güncelleme Kontrol Et
          </button>
        </div>
        {updateError ? <div className="alert" style={{ marginTop: 12 }}>{updateError}</div> : null}
        {updateResult ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 650 }}>Yerel:</span> {updateResult.currentVersion}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <span style={{ fontWeight: 650 }}>Sunucu:</span> {updateResult.latestVersion}
            </p>
            {updateResult.hasUpdate ? (
              <p style={{ margin: '8px 0 0', color: '#0c4a6e', fontWeight: 650 }}>
                Yeni sürüm mevcut.
              </p>
            ) : (
              <p style={{ margin: '8px 0 0' }}>Güncel görünüyorsunuz.</p>
            )}
            {updateResult.releaseNotes ? (
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{updateResult.releaseNotes}</p>
            ) : null}
            {updateResult.hasUpdate && updateResult.downloadUrl ? (
              <button
                type="button"
                className="btn btnGhost"
                style={{ marginTop: 12 }}
                onClick={() => void openDownload(updateResult.downloadUrl ?? '')}
              >
                İndirme bağlantısını aç
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="flexBetween">
          <div>
            <p className="h2">Başlangıçta otomatik başlat</p>
            <p className="muted" style={{ marginTop: 8 }}>
              İşletim sistemi oturum açılışında uygulamayı başlatır (Tauri autostart eklentisi).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={launchOnStartup}
            disabled={busy}
            onClick={() => void onToggleAutostart(!launchOnStartup)}
            className={`toggle ${launchOnStartup ? 'toggleOn' : 'toggleOff'}`}
          >
            <span className={`knob ${launchOnStartup ? 'knobOn' : ''}`} />
          </button>
        </div>
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
          {feedbackMessage ? (
            <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>{feedbackMessage}</p>
          ) : null}
        </div>
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
