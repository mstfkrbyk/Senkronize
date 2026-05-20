import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState, type ReactElement } from 'react';

import { SyncScheduleSettings } from '@/components/SyncScheduleSettings';
import { TraySettings } from '@/components/TraySettings';
import { tauriApi, type UpdateCheckResponse } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

export interface SettingsPageProps {
  onResetSession: () => void;
}

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '••••••••';
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export function SettingsPage({ onResetSession }: SettingsPageProps): ReactElement {
  const token = useAppStore((s) => s.token);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const localErpBaseUrl = useAppStore((s) => s.localErpBaseUrl);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const setLocalErpBaseUrl = useAppStore((s) => s.setLocalErpBaseUrl);
  const setHealth = useAppStore((s) => s.setHealth);

  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResponse | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);
  const [revealToken, setRevealToken] = useState(false);
  const [manualApiKey, setManualApiKey] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const v = await getVersion();
        setDesktopVersion(v);
      } catch {
        setDesktopVersion(null);
      }
    })();
  }, []);

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

  useEffect(() => {
    setManualApiKey('');
    setRevealToken(false);
  }, [token?.token]);

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

  async function onTestCloud(): Promise<void> {
    if (!token) {
      setFeedbackMessage('Bulut testi için oturum gerekli.');
      return;
    }
    setBusy(true);
    setFeedbackMessage(null);
    try {
      const key = manualApiKey.trim().length > 0 ? manualApiKey.trim() : token.token;
      const h = await tauriApi.checkHealth(apiUrl.trim(), key, null);
      setHealth(h);
      setFeedbackMessage(
        h.cloudConnected
          ? 'Bulut API erişilebilir ve kimlik doğrulaması başarılı görünüyor.'
          : 'Bulut API yanıt vermedi veya kimlik doğrulanamadı.',
      );
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
      const res = await tauriApi.checkForUpdates(apiUrl.trim().length > 0 ? apiUrl.trim() : null);
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

  const effectiveKeyPreview = manualApiKey.trim().length > 0 ? maskToken(manualApiKey.trim()) : token ? maskToken(token.token) : null;

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">Ayarlar</h1>
        <p className="muted">Bağlantı, tray, güncelleme ve yerel çalışma tercihleri.</p>
        {desktopVersion ? (
          <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
            Masaüstü sürümü: <span style={{ fontWeight: 650 }}>{desktopVersion}</span>
          </p>
        ) : null}
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
          Sağlık kontrolü, güncelleme ve senkron istekleri bu tabana göre çözümlenir.
        </p>

        <label className="fieldLabel" htmlFor="settingsApiKey" style={{ marginTop: 16 }}>
          API anahtarı (Bearer)
        </label>
        <input
          id="settingsApiKey"
          className="input"
          type={revealToken ? 'text' : 'password'}
          value={manualApiKey}
          onChange={(e) => setManualApiKey(e.target.value)}
          placeholder={token ? "Boş bırakırsanız oturum token'ı kullanılır" : 'Önce oturum açın'}
          autoComplete="off"
        />
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
          <button type="button" className="btn btnGhost" onClick={() => setRevealToken((v) => !v)}>
            {revealToken ? 'Gizle' : 'Göster'}
          </button>
          {effectiveKeyPreview ? (
            <span className="muted" style={{ fontSize: 13 }}>
              Önizleme: {effectiveKeyPreview}
            </span>
          ) : null}
        </div>

        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => void onTestCloud()}
            className="btn btnAccent"
          >
            Bağlantıyı Test Et
          </button>
        </div>
      </div>

      <SyncScheduleSettings />

      <TraySettings />

      <div className="panel">
        <p className="h2">Uygulama güncellemesi</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Sürüm bilgisi için{' '}
          <span style={{ fontWeight: 650 }}>{apiUrl.trim() || 'https://api.senkronize.com'}</span> tabanındaki{' '}
          <span style={{ fontWeight: 650 }}>/api/v1/app/version</span> uç noktası kullanılır.
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
              <span style={{ fontWeight: 650 }}>Masaüstü (Tauri):</span> {updateResult.currentVersion}
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
