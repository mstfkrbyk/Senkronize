import { Link2 } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

type ErpKind = 'LOGO' | 'MIKRO' | 'NETSIS';
type SyncInterval = '15m' | '30m' | '1h' | '3h';

const ERP_LABELS: Record<ErpKind, string> = {
  LOGO: 'Logo Tiger',
  MIKRO: 'Mikro ERP',
  NETSIS: 'Netsis',
};

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '••••••••';
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export function ErpBridgePage(): ReactElement {
  const token = useAppStore((s) => s.token);
  const apiUrl = useAppStore((s) => s.apiUrl);

  const [erpType, setErpType] = useState<ErpKind>('LOGO');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [extra, setExtra] = useState('');

  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [syncInterval, setSyncInterval] = useState<SyncInterval>('30m');
  const [autoSyncOn, setAutoSyncOn] = useState(false);

  const cloudKeyPreview = useMemo(() => {
    if (!token?.token) {
      return null;
    }
    return maskToken(token.token);
  }, [token?.token]);

  async function onTestConnection(): Promise<void> {
    setBusy(true);
    setTestMessage(null);
    setTestOk(null);
    try {
      const res = await tauriApi.testErpConnection({
        erpType,
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        password,
        extra: extra.trim() ? extra.trim() : null,
      });
      setTestOk(res.success);
      setTestMessage(res.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestOk(false);
      setTestMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function onManualSync(): Promise<void> {
    if (!token) {
      setSyncMessage('Oturum yok; önce kurulumdan giriş yapın.');
      return;
    }
    setBusy(true);
    setSyncMessage(null);
    try {
      const res = await tauriApi.syncErpToCloud({
        erpConfig: {
          erpType,
          baseUrl: baseUrl.trim(),
          username: username.trim(),
          password,
          extra: extra.trim() ? extra.trim() : null,
        },
        cloudApiUrl: apiUrl.trim(),
        cloudApiKey: token.token,
      });
      setSyncMessage(`${res.message} (${res.syncedCount} kayıt, ${res.errorCount} hata)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncMessage(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">ERP Bridge</h1>
        <p className="muted">Yerel ERP ile bulut arasında adım adım kurulum ve senkronizasyon.</p>
      </div>

      <div className="panel">
        <p className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={18} aria-hidden />
          1. ERP bağlantısı
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          Logo, Mikro veya Netsis REST uç noktasına kimlik doğrulama isteği gönderilir.
        </p>

        <label className="fieldLabel" htmlFor="erpType" style={{ marginTop: 16 }}>
          ERP tipi
        </label>
        <select
          id="erpType"
          className="select"
          value={erpType}
          onChange={(e) => setErpType(e.target.value as ErpKind)}
        >
          {(Object.keys(ERP_LABELS) as ErpKind[]).map((k) => (
            <option key={k} value={k}>
              {ERP_LABELS[k]}
            </option>
          ))}
        </select>

        <label className="fieldLabel" htmlFor="erpBaseUrl">
          Sunucu URL
        </label>
        <input
          id="erpBaseUrl"
          className="input"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://erp.sirket.local"
          autoComplete="off"
        />

        <label className="fieldLabel" htmlFor="erpUser">
          Kullanıcı adı
        </label>
        <input
          id="erpUser"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <label className="fieldLabel" htmlFor="erpPass">
          Şifre
        </label>
        <input
          id="erpPass"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <label className="fieldLabel" htmlFor="erpExtra">
          Ek (firma no / veritabanı)
        </label>
        <input
          id="erpExtra"
          className="input"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Opsiyonel"
          autoComplete="off"
        />

        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            disabled={busy || baseUrl.trim().length === 0}
            onClick={() => void onTestConnection()}
            className="btn btnAccent"
          >
            Bağlantıyı Test Et
          </button>
          {testOk === true ? (
            <span className="pill" style={{ borderColor: '#a7f3d0', background: '#ecfdf5', color: '#047857' }}>
              <span className="dot dotOk" />
              Başarılı
            </span>
          ) : null}
          {testOk === false ? (
            <span className="pill" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
              <span className="dot dotBad" />
              Başarısız
            </span>
          ) : null}
        </div>
        {testMessage ? (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
            {testMessage}
          </p>
        ) : null}
      </div>

      <div className="panel">
        <p className="h2">2. Bulut API bağlantısı</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Kimlik, Ayarlar&apos;daki API URL ve kurulumda kaydedilen oturum token&apos;ı ile yapılır
          (ayrı API anahtarı alanı yok).
        </p>
        <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>
          <div>
            <span style={{ fontWeight: 650 }}>API URL:</span> {apiUrl || '—'}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontWeight: 650 }}>Token:</span> {cloudKeyPreview ?? '—'}
          </div>
        </div>
        <button
          type="button"
          disabled={busy || !token || baseUrl.trim().length === 0}
          onClick={() => void onManualSync()}
          className="btn btnGhost"
          style={{ marginTop: 14 }}
        >
          Manuel Sync Et
        </button>
        {syncMessage ? (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
            {syncMessage}
          </p>
        ) : null}
      </div>

      <div className="panel">
        <p className="h2">3. Otomatik sync ayarı</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Aralık ve anahtar yalnızca arayüzde tutulur; arka planda zamanlayıcı entegrasyonu sonraki
          adımda eklenecek.
        </p>
        <label className="fieldLabel" htmlFor="erpSyncInterval" style={{ marginTop: 12 }}>
          Sync aralığı
        </label>
        <select
          id="erpSyncInterval"
          className="select"
          value={syncInterval}
          onChange={(e) => setSyncInterval(e.target.value as SyncInterval)}
        >
          <option value="15m">15 dakika</option>
          <option value="30m">30 dakika</option>
          <option value="1h">1 saat</option>
          <option value="3h">3 saat</option>
        </select>
        <div className="flexBetween" style={{ marginTop: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Otomatik sync başlat</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Açıkken tercih kaydedilir; görev henüz çalıştırılmaz.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoSyncOn}
            onClick={() => setAutoSyncOn((v) => !v)}
            className={`toggle ${autoSyncOn ? 'toggleOn' : 'toggleOff'}`}
          >
            <span className={`knob ${autoSyncOn ? 'knobOn' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
