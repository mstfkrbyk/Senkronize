import { listen } from '@tauri-apps/api/event';
import { Activity, Link2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { appendSyncLog } from '@/lib/sync-log-store';
import { loadSyncSettings } from '@/lib/sync-settings-store';
import { tauriApi, type ErpSyncEngineResult } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

type ErpKind = 'BIZIMHESAP' | 'LOGO' | 'NEBIM' | 'PARASUT';

const ERP_LABELS: Record<ErpKind, string> = {
  BIZIMHESAP: 'Bizim Hesap',
  LOGO: 'Logo Tiger',
  NEBIM: 'Nebim V3',
  PARASUT: 'Paraşüt',
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
  const health = useAppStore((s) => s.health);
  const setHealth = useAppStore((s) => s.setHealth);

  const [erpType, setErpType] = useState<ErpKind>('LOGO');
  const [apiToken, setApiToken] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('1433');
  const [dbName, setDbName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testVersion, setTestVersion] = useState<string | null>(null);
  const [testProductCount, setTestProductCount] = useState<number | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastServerSync, setLastServerSync] = useState<string | null>(null);

  const cloudKeyPreview = useMemo(() => {
    if (!token?.token) {
      return null;
    }
    return maskToken(token.token);
  }, [token?.token]);

  const connectionPayload = useMemo(() => {
    switch (erpType) {
      case 'BIZIMHESAP':
        return {
          erpType,
          baseUrl: endpoint.trim() || 'https://api.bizimhesap.com',
          username: '',
          password: apiToken,
          extra: null as string | null,
        };
      case 'LOGO':
        return {
          erpType,
          baseUrl: endpoint.trim(),
          username: '',
          password: '',
          extra: companyCode.trim() || null,
        };
      case 'NEBIM':
        return {
          erpType,
          baseUrl: `http://${serverIp.trim()}:${serverPort.trim()}`,
          username: username.trim(),
          password,
          extra: dbName.trim() || null,
        };
      case 'PARASUT':
        return {
          erpType,
          baseUrl: endpoint.trim() || 'https://api.parasut.com',
          username: '',
          password: apiKey,
          extra: null as string | null,
        };
      default:
        return { erpType, baseUrl: '', username: '', password: '', extra: null as string | null };
    }
  }, [apiKey, apiToken, companyCode, endpoint, erpType, password, serverIp, serverPort, username, dbName]);

  const credentials = useMemo(
    () => ({
      erpType: connectionPayload.erpType,
      baseUrl: connectionPayload.baseUrl,
      username: connectionPayload.username,
      password: connectionPayload.password,
      extra: connectionPayload.extra,
      serverIp: serverIp.trim(),
      serverPort: serverPort.trim(),
      database: dbName.trim(),
      companyCode: companyCode.trim(),
      apiKey: apiKey.trim(),
      apiToken: apiToken.trim(),
    }),
    [connectionPayload, serverIp, serverPort, dbName, companyCode, apiKey, apiToken],
  );

  const formValid = useMemo(() => {
    switch (erpType) {
      case 'BIZIMHESAP':
        return apiToken.trim().length > 0;
      case 'LOGO':
        return endpoint.trim().length > 0 && companyCode.trim().length > 0;
      case 'NEBIM':
        return (
          serverIp.trim().length > 0 &&
          serverPort.trim().length > 0 &&
          dbName.trim().length > 0 &&
          username.trim().length > 0 &&
          password.length > 0
        );
      case 'PARASUT':
        return apiKey.trim().length > 0;
      default:
        return false;
    }
  }, [apiKey, apiToken, companyCode, endpoint, erpType, password, serverIp, serverPort, username, dbName]);

  const refreshSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const st = await tauriApi.getSyncStatus();
      setLastServerSync(st.lastSync);
    } catch {
      /* sessiz */
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
        const h = await tauriApi.checkHealth(apiUrl, token.token, connectionPayload.baseUrl || null);
        setHealth(h);
      } catch {
        /* ağ yoksa sessiz */
      }
    })();
  }, [apiUrl, connectionPayload.baseUrl, setHealth, token]);

  const summarizeEngine = useCallback((label: string, res: ErpSyncEngineResult, kind: 'Ürün' | 'Sipariş'): string => {
    const errPart = res.errors.length ? ` | Uyarı: ${res.errors.join(' · ')}` : '';
    return `${label} — ${kind}: ${kind === 'Ürün' ? res.productsSynced : res.ordersPushed} (${res.durationMs} ms)${errPart}`;
  }, []);

  const runFullErpSync = useCallback(
    async (sourceLabel: string): Promise<void> => {
      const tok = useAppStore.getState().token;
      if (!tok) {
        setSyncMessage('Oturum yok; önce kurulumdan giriş yapın.');
        return;
      }
      if (!formValid) {
        setSyncMessage('ERP bağlantı bilgileri eksik.');
        return;
      }

      const settings = loadSyncSettings();
      setSyncBusy(true);
      setSyncMessage(null);
      const started = Date.now();
      try {
        await tauriApi.setTrayIndicator('syncing');

        let products: ErpSyncEngineResult;
        if (settings.deltaOnly) {
          const delta = await tauriApi.syncDelta({
            erpType,
            credentials,
            cloudApiUrl: apiUrl.trim(),
            apiKey: tok.token,
            since: lastServerSync,
          });
          products = {
            productsSynced: delta.productsSynced,
            ordersPushed: 0,
            errors: delta.errors,
            durationMs: delta.durationMs,
            syncedAt: delta.syncedAt,
          };
        } else {
          products = await tauriApi.syncErpProducts({
            erpType,
            credentials,
            cloudApiUrl: apiUrl.trim(),
            apiKey: tok.token,
          });
        }

        let orders: ErpSyncEngineResult = {
          productsSynced: 0,
          ordersPushed: 0,
          errors: [],
          durationMs: 0,
          syncedAt: products.syncedAt,
        };
        if (settings.syncOrder) {
          orders = await tauriApi.syncErpOrders({
            erpType,
            credentials,
            cloudApiUrl: apiUrl.trim(),
            apiKey: tok.token,
          });
        }

        const softFail = products.errors.length + orders.errors.length > 0;
        const summary = [
          summarizeEngine(sourceLabel, products, 'Ürün'),
          settings.syncOrder ? summarizeEngine(sourceLabel, orders, 'Sipariş') : null,
        ]
          .filter(Boolean)
          .join('\n');

        setSyncMessage(summary);

        appendSyncLog({
          type: 'PRODUCT',
          status: softFail ? 'PARTIAL' : 'SUCCESS',
          itemCount: products.productsSynced,
          duration: Date.now() - started,
          error: softFail ? products.errors.join(' · ') : undefined,
        });
        if (settings.syncOrder) {
          appendSyncLog({
            type: 'ORDER',
            status: orders.errors.length ? 'PARTIAL' : 'SUCCESS',
            itemCount: orders.ordersPushed,
            duration: orders.durationMs,
            error: orders.errors.length ? orders.errors.join(' · ') : undefined,
          });
        }

        await tauriApi.recordLastSync(orders.syncedAt);
        await refreshSyncStatus();
        await tauriApi.setTrayIndicator(softFail ? 'error' : 'idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSyncMessage(message);
        appendSyncLog({
          type: 'PRODUCT',
          status: 'FAILED',
          itemCount: 0,
          duration: Date.now() - started,
          error: message,
        });
        await tauriApi.setTrayIndicator('error');
      } finally {
        setSyncBusy(false);
      }
    },
    [
      apiUrl,
      credentials,
      erpType,
      formValid,
      lastServerSync,
      refreshSyncStatus,
      summarizeEngine,
    ],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen('auto-sync-tick', () => {
        if (!useAppStore.getState().token) {
          return;
        }
        void runFullErpSync('Zamanlayıcı');
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [runFullErpSync]);

  const cloudConnected = health?.cloudConnected === true;
  const erpLineOk = testOk === true;
  const overallOk = cloudConnected && erpLineOk;

  async function onTestConnection(): Promise<void> {
    setTestModalOpen(true);
    setTestBusy(true);
    setTestMessage(null);
    setTestOk(null);
    setTestVersion(null);
    setTestProductCount(null);
    setTestDurationMs(null);
    try {
      const res = await tauriApi.testErpConnection(connectionPayload);
      setTestOk(res.success);
      setTestMessage(res.message);
      setTestVersion(res.erpVersion);
      setTestProductCount(res.productCount);
      setTestDurationMs(res.durationMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestOk(false);
      setTestMessage(message);
    } finally {
      setTestBusy(false);
    }
  }

  function formatTs(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString('tr-TR');
  }

  function renderErpFields(): ReactElement {
    switch (erpType) {
      case 'BIZIMHESAP':
        return (
          <>
            <label className="fieldLabel" htmlFor="bhToken">
              API Token
            </label>
            <input
              id="bhToken"
              type="password"
              className="input"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              autoComplete="off"
            />
          </>
        );
      case 'LOGO':
        return (
          <>
            <label className="fieldLabel" htmlFor="logoEndpoint">
              Bağlantı Noktası
            </label>
            <input
              id="logoEndpoint"
              className="input"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://erp.sirket.local"
              autoComplete="off"
            />
            <label className="fieldLabel" htmlFor="logoCompany">
              Şirket Kodu
            </label>
            <input
              id="logoCompany"
              className="input"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              autoComplete="off"
            />
          </>
        );
      case 'NEBIM':
        return (
          <>
            <div className="grid2">
              <div>
                <label className="fieldLabel" htmlFor="nebimIp">
                  Sunucu IP
                </label>
                <input
                  id="nebimIp"
                  className="input"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  placeholder="192.168.1.10"
                />
              </div>
              <div>
                <label className="fieldLabel" htmlFor="nebimPort">
                  Port
                </label>
                <input
                  id="nebimPort"
                  className="input"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value)}
                />
              </div>
            </div>
            <label className="fieldLabel" htmlFor="nebimDb">
              Veritabanı adı
            </label>
            <input id="nebimDb" className="input" value={dbName} onChange={(e) => setDbName(e.target.value)} />
            <label className="fieldLabel" htmlFor="nebimUser">
              Kullanıcı
            </label>
            <input id="nebimUser" className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="fieldLabel" htmlFor="nebimPass">
              Şifre
            </label>
            <input
              id="nebimPass"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </>
        );
      case 'PARASUT':
        return (
          <>
            <label className="fieldLabel" htmlFor="psKey">
              API Key
            </label>
            <input
              id="psKey"
              type="password"
              className="input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </>
        );
      default:
        return <p className="muted">Desteklenmeyen ERP tipi.</p>;
    }
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
          Son senkron: {lastServerSync ? formatTs(lastServerSync) : '—'}
        </p>
      </div>

      <div className="panel">
        <p className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={18} aria-hidden />
          ERP bağlantı bilgileri
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          ERP türüne göre gerekli alanlar gösterilir.
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

        <div style={{ marginTop: 12 }}>{renderErpFields()}</div>

        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            disabled={testBusy || !formValid}
            onClick={() => void onTestConnection()}
            className="btn btnAccent"
          >
            Bağlantıyı Test Et
          </button>
        </div>
      </div>

      <div className="panel">
        <p className="h2">Bulut API</p>
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
            disabled={syncBusy || !token || !formValid}
            onClick={() => void runFullErpSync('Manuel')}
            className="btn btnAccent"
          >
            {syncBusy ? 'Senkronize ediliyor…' : 'Şimdi Senkronize Et'}
          </button>
        </div>
        {syncMessage ? (
          <pre className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {syncMessage}
          </pre>
        ) : null}
      </div>

      {testModalOpen ? (
        <div className="modalBackdrop" role="presentation" onClick={() => !testBusy && setTestModalOpen(false)}>
          <div
            className="modalCard"
            role="dialog"
            aria-labelledby="erp-test-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="erp-test-title" className="h2">
              Bağlantı testi
            </h2>
            {testBusy ? (
              <div className="row" style={{ marginTop: 16, gap: 10 }}>
                <span className="spinner" aria-hidden />
                <span className="muted">ERP bağlantısı test ediliyor…</span>
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                {testOk === true ? <p className="testResultOk">✓ Bağlantı başarılı</p> : null}
                {testOk === false ? (
                  <p className="testResultBad">✗ {testMessage ?? 'Bağlantı başarısız'}</p>
                ) : null}
                {testOk === true ? (
                  <ul className="muted" style={{ marginTop: 12, paddingLeft: 18, fontSize: 13 }}>
                    {testVersion ? <li>ERP sürümü: {testVersion}</li> : null}
                    {testProductCount !== null ? <li>Bulunan ürün sayısı: {testProductCount}</li> : null}
                    {testDurationMs !== null ? <li>Bağlantı süresi: {testDurationMs} ms</li> : null}
                  </ul>
                ) : null}
                {testOk === false && testDurationMs !== null ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Süre: {testDurationMs} ms
                  </p>
                ) : null}
              </div>
            )}
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btnGhost"
                disabled={testBusy}
                onClick={() => setTestModalOpen(false)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
