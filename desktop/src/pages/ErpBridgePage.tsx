import { listen } from '@tauri-apps/api/event';
import { Activity, Link2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { tauriApi, type ErpSyncEngineResult } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

type ErpKind = 'LOGO' | 'MIKRO' | 'NETSIS';
type SyncIntervalMinutes = 5 | 15 | 30 | 60;

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

interface ErpHistoryEntry {
  id: string;
  at: string;
  ok: boolean;
  summary: string;
}

export function ErpBridgePage(): ReactElement {
  const token = useAppStore((s) => s.token);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const health = useAppStore((s) => s.health);
  const setHealth = useAppStore((s) => s.setHealth);

  const [erpType, setErpType] = useState<ErpKind>('LOGO');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [extra, setExtra] = useState('');

  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [intervalMinutes, setIntervalMinutes] = useState<SyncIntervalMinutes>(15);
  const [autoSyncOn, setAutoSyncOn] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [lastServerSync, setLastServerSync] = useState<string | null>(null);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const [history, setHistory] = useState<ErpHistoryEntry[]>([]);

  const cloudKeyPreview = useMemo(() => {
    if (!token?.token) {
      return null;
    }
    return maskToken(token.token);
  }, [token?.token]);

  const credentials = useMemo(
    () => ({
      erpType,
      baseUrl: baseUrl.trim(),
      username: username.trim(),
      password,
      extra: extra.trim() ? extra.trim() : null,
    }),
    [erpType, baseUrl, username, password, extra],
  );

  const pushHistory = useCallback((ok: boolean, summary: string): void => {
    const entry: ErpHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      ok,
      summary,
    };
    setHistory((h) => [entry, ...h].slice(0, 10));
  }, []);

  const summarizeEngine = useCallback((label: string, res: ErpSyncEngineResult, kind: 'Ürün' | 'Sipariş'): string => {
    const errPart = res.errors.length ? ` | Uyarı: ${res.errors.join(' · ')}` : '';
    return `${label} — ${kind}: ${kind === 'Ürün' ? res.productsSynced : res.ordersPushed} (${res.durationMs} ms)${errPart}`;
  }, []);

  const refreshSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const st = await tauriApi.getSyncStatus();
      setLastServerSync(st.lastSync);
      setSchedulerRunning(st.isRunning);
      setAutoSyncOn(st.isRunning);
      if (st.isRunning && [5, 15, 30, 60].includes(st.intervalMinutes)) {
        setIntervalMinutes(st.intervalMinutes as SyncIntervalMinutes);
      }
    } catch {
      /* durum okunamazsa sessiz */
    }
  }, []);

  useEffect(() => {
    void refreshSyncStatus();
  }, [refreshSyncStatus]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void (async () => {
      try {
        const h = await tauriApi.checkHealth(apiUrl, token.token, baseUrl.trim() || null);
        setHealth(h);
      } catch {
        /* ağ yoksa sessiz */
      }
    })();
  }, [apiUrl, baseUrl, setHealth, token]);

  const runFullErpSync = useCallback(
    async (sourceLabel: string): Promise<void> => {
      const tok = useAppStore.getState().token;
      if (!tok) {
        setSyncMessage('Oturum yok; önce kurulumdan giriş yapın.');
        pushHistory(false, `${sourceLabel}: oturum yok`);
        return;
      }
      if (baseUrl.trim().length === 0) {
        setSyncMessage('ERP sunucu URL gerekli.');
        pushHistory(false, `${sourceLabel}: URL eksik`);
        return;
      }

      setSyncBusy(true);
      setSyncMessage(null);
      try {
        await tauriApi.setTrayIndicator('syncing');
        const products = await tauriApi.syncErpProducts({
          erpType,
          credentials,
          cloudApiUrl: apiUrl.trim(),
          apiKey: tok.token,
        });
        const orders = await tauriApi.syncErpOrders({
          erpType,
          credentials,
          cloudApiUrl: apiUrl.trim(),
          apiKey: tok.token,
        });

        const softFail = products.errors.length + orders.errors.length > 0;
        const summary = [
          summarizeEngine(sourceLabel, products, 'Ürün'),
          summarizeEngine(sourceLabel, orders, 'Sipariş'),
        ].join('\n');

        setSyncMessage(summary);
        pushHistory(!softFail, summary);

        await tauriApi.recordLastSync(orders.syncedAt);
        await refreshSyncStatus();
        await tauriApi.setTrayIndicator(softFail ? 'error' : 'idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSyncMessage(message);
        pushHistory(false, `${sourceLabel}: ${message}`);
        await tauriApi.setTrayIndicator('error');
      } finally {
        setSyncBusy(false);
      }
    },
    [apiUrl, baseUrl, credentials, erpType, pushHistory, refreshSyncStatus, summarizeEngine],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen('auto-sync-tick', () => {
        if (!autoSyncOn || !useAppStore.getState().token) {
          return;
        }
        void runFullErpSync('Zamanlayıcı');
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [autoSyncOn, runFullErpSync]);

  const cloudConnected = health?.cloudConnected === true;
  const erpLineOk = testOk === true;
  const overallOk = cloudConnected && erpLineOk;

  async function onTestConnection(): Promise<void> {
    setTestBusy(true);
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
      setTestBusy(false);
    }
  }

  async function onManualSync(): Promise<void> {
    await runFullErpSync('Manuel');
  }

  async function onToggleAutoSync(next: boolean): Promise<void> {
    if (!token) {
      setSyncMessage('Otomatik senkron için oturum gerekli.');
      return;
    }
    setAutoBusy(true);
    try {
      if (next) {
        await tauriApi.startAutoSync(intervalMinutes);
      } else {
        await tauriApi.stopAutoSync();
      }
      await refreshSyncStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncMessage(message);
    } finally {
      setAutoBusy(false);
    }
  }

  async function onIntervalChange(minutes: SyncIntervalMinutes): Promise<void> {
    setIntervalMinutes(minutes);
    if (!autoSyncOn || !token) {
      return;
    }
    setAutoBusy(true);
    try {
      await tauriApi.stopAutoSync();
      await tauriApi.startAutoSync(minutes);
      await refreshSyncStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncMessage(message);
    } finally {
      setAutoBusy(false);
    }
  }

  function formatTs(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString('tr-TR');
  }

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">ERP Köprüsü</h1>
        <p className="muted">Yerel ERP ile bulut arasında ürün ve sipariş senkronu.</p>
      </div>

      <div className="panel">
        <p className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} aria-hidden />
          Bağlantı özeti
        </p>
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span
            className="pill"
            style={{
              borderColor: overallOk ? '#a7f3d0' : '#fecaca',
              background: overallOk ? '#ecfdf5' : '#fef2f2',
              color: overallOk ? '#047857' : '#b91c1c',
            }}
          >
            <span className={`dot ${overallOk ? 'dotOk' : 'dotBad'}`} />
            {overallOk ? 'Bulut + ERP hattı hazır' : 'Bağlantı eksik / doğrulanmadı'}
          </span>
          <span className="muted" style={{ fontSize: 13, margin: 0 }}>
            Bulut: {cloudConnected ? 'çevrimiçi' : 'çevrimdışı'} · ERP testi:{' '}
            {testOk === null ? 'henüz yok' : testOk ? 'başarılı' : 'başarısız'}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
          Son senkron (masaüstü): {lastServerSync ? formatTs(lastServerSync) : '—'}
          {schedulerRunning ? ` · Zamanlayıcı: ${intervalMinutes} dk` : ''}
        </p>
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
            disabled={testBusy || baseUrl.trim().length === 0}
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
        <p className="h2">2. Bulut API</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Kimlik, Ayarlar&apos;daki API tabanı ve kurulum token&apos;ı ile çağrı yapılır.
        </p>
        <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>
          <div>
            <span style={{ fontWeight: 650 }}>API URL:</span> {apiUrl || '—'}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontWeight: 650 }}>Token:</span> {cloudKeyPreview ?? '—'}
          </div>
        </div>
        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            disabled={syncBusy || !token || baseUrl.trim().length === 0}
            onClick={() => void onManualSync()}
            className="btn btnAccent"
          >
            {syncBusy ? 'Senkronize ediliyor…' : 'Şimdi Senkronize Et'}
          </button>
        </div>
        {syncMessage ? (
          <pre
            className="muted"
            style={{ marginTop: 10, marginBottom: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}
          >
            {syncMessage}
          </pre>
        ) : null}
      </div>

      <div className="panel">
        <p className="h2">3. Senkronizasyon geçmişi</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Son 10 ERP senkron denemesi (manuel veya zamanlayıcı).
        </p>
        {history.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            Henüz kayıt yok.
          </p>
        ) : (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: '#334155', fontSize: 13 }}>
            {history.map((h) => (
              <li key={h.id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 650 }}>{formatTs(h.at)}</span>{' '}
                <span style={{ color: h.ok ? '#047857' : '#b91c1c' }}>{h.ok ? '✓' : '✕'}</span>{' '}
                <span style={{ whiteSpace: 'pre-wrap' }}>{h.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <p className="h2">4. Otomatik senkron</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Arka planda zamanlayıcı açıkken bu sayfadaki ERP akışı tetiklenir (ayrıca Durum sayfasındaki
          pazaryeri senkronu da çalışır).
        </p>
        <label className="fieldLabel" htmlFor="erpSyncInterval" style={{ marginTop: 12 }}>
          Aralık (dakika)
        </label>
        <select
          id="erpSyncInterval"
          className="select"
          value={intervalMinutes}
          onChange={(e) => void onIntervalChange(Number(e.target.value) as SyncIntervalMinutes)}
          disabled={autoBusy}
        >
          <option value={5}>5 dakika</option>
          <option value={15}>15 dakika</option>
          <option value={30}>30 dakika</option>
          <option value={60}>60 dakika</option>
        </select>
        <div className="flexBetween" style={{ marginTop: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>Otomatik senkron</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Açıkken Tauri görevi çalışır; kapatınca durur.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoSyncOn}
            disabled={autoBusy || !token}
            onClick={() => void onToggleAutoSync(!autoSyncOn)}
            className={`toggle ${autoSyncOn ? 'toggleOn' : 'toggleOff'}`}
          >
            <span className={`knob ${autoSyncOn ? 'knobOn' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
