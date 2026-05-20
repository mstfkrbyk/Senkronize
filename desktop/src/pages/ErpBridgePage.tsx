import { listen } from '@tauri-apps/api/event';
import { Activity, Database, Link2, Package, ShoppingCart, Warehouse } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { SyncProgress, type SyncPhase } from '@/components/SyncProgress';
import { loadCloudErpSyncSettings } from '@/lib/cloud-erp-api';
import { showDesktopNotification } from '@/lib/desktop-notify';
import {
  ERP_LABELS,
  loadErpBridgeForm,
  loadErpResourceCounts,
  saveErpBridgeForm,
  saveErpResourceCounts,
  type ErpKind,
  type ErpResourceCounts,
} from '@/lib/erp-bridge-store';
import { appendSyncLog, updateSyncLog } from '@/lib/sync-log-store';
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from '@/lib/sync-settings-store';
import { tauriApi, type ErpSyncEngineResult } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

type ConnectionTone = 'ok' | 'warn' | 'bad';

function maskToken(token: string): string {
  if (token.length <= 12) {
    return '••••••••';
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('tr-TR');
}

function intervalLabel(minutes: number | null): string {
  if (minutes === null) {
    return 'Manuel';
  }
  if (minutes === 60) {
    return 'Her 1 saat';
  }
  return `Her ${minutes} dk`;
}

export function ErpBridgePage(): ReactElement {
  const token = useAppStore((s) => s.token);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const health = useAppStore((s) => s.health);
  const setHealth = useAppStore((s) => s.setHealth);

  const [form, setForm] = useState(() => loadErpBridgeForm());
  const [resourceCounts, setResourceCounts] = useState<ErpResourceCounts>(() => loadErpResourceCounts());
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => loadSyncSettings());

  const [testBusy, setTestBusy] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testVersion, setTestVersion] = useState<string | null>(null);
  const [testProductCount, setTestProductCount] = useState<number | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastServerSync, setLastServerSync] = useState<string | null>(null);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('products');
  const [syncCurrent, setSyncCurrent] = useState(0);
  const [syncTotal, setSyncTotal] = useState(4);
  const [syncProgressStatus, setSyncProgressStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  const { erpType, serverIp, serverPort, dbName, apiKey, apiToken, connectionString } = form;

  const updateForm = useCallback((patch: Partial<typeof form>): void => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveErpBridgeForm(next);
      return next;
    });
  }, []);

  useEffect(() => {
    void tauriApi.setTrayErpName(ERP_LABELS[erpType]);
  }, [erpType]);

  const connectionPayload = useMemo(() => {
    switch (erpType) {
      case 'BIZIMHESAP':
        return {
          erpType,
          baseUrl: 'https://api.bizimhesap.com',
          username: '',
          password: apiKey,
          extra: null as string | null,
        };
      case 'LOGO': {
        const host = serverIp.trim();
        const port = serverPort.trim() || '1433';
        return {
          erpType,
          baseUrl: host ? `http://${host}:${port}` : '',
          username: '',
          password: '',
          extra: dbName.trim() || null,
        };
      }
      case 'PARASUT':
        return {
          erpType,
          baseUrl: 'https://api.parasut.com',
          username: '',
          password: apiToken,
          extra: null as string | null,
        };
      case 'MIKRO':
        return {
          erpType,
          baseUrl: connectionString.trim(),
          username: '',
          password: connectionString.trim(),
          extra: null as string | null,
        };
      default:
        return { erpType, baseUrl: '', username: '', password: '', extra: null as string | null };
    }
  }, [apiKey, apiToken, connectionString, dbName, erpType, serverIp, serverPort]);

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
      apiKey: apiKey.trim(),
      apiToken: apiToken.trim(),
      connectionString: connectionString.trim(),
    }),
    [apiKey, apiToken, connectionPayload, connectionString, dbName, serverIp, serverPort],
  );

  const formValid = useMemo(() => {
    switch (erpType) {
      case 'BIZIMHESAP':
        return apiKey.trim().length > 0;
      case 'LOGO':
        return serverIp.trim().length > 0 && dbName.trim().length > 0;
      case 'PARASUT':
        return apiToken.trim().length > 0;
      case 'MIKRO':
        return connectionString.trim().length > 0;
      default:
        return false;
    }
  }, [apiKey, apiToken, connectionString, dbName, erpType, serverIp]);

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
    if (!token?.token) {
      return;
    }
    void (async () => {
      try {
        const cloud = await loadCloudErpSyncSettings(apiUrl.trim(), token.token, erpType);
        if (cloud) {
          saveSyncSettings(cloud);
          setSyncSettings(cloud);
        }
      } catch {
        /* bulut ayarları yoksa yerel varsayılanlar */
      }
    })();
  }, [apiUrl, erpType, token?.token]);

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

  const connectionTone = useMemo((): ConnectionTone => {
    const cloudOk = health?.cloudConnected === true;
    if (testOk === true && cloudOk) {
      return 'ok';
    }
    if (testOk === false || !cloudOk) {
      return testOk === null && !cloudOk ? 'warn' : 'bad';
    }
    if (testOk === null) {
      return cloudOk ? 'warn' : 'bad';
    }
    return 'warn';
  }, [health?.cloudConnected, testOk]);

  const connectionLabel = useMemo(() => {
    if (connectionTone === 'ok') {
      return 'Bağlantı hazır';
    }
    if (connectionTone === 'warn') {
      return 'Kısmen hazır — ERP testi gerekli';
    }
    return 'Bağlantı sorunlu';
  }, [connectionTone]);

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
      const phases: SyncPhase[] = [];
      if (settings.syncProduct) {
        phases.push('products');
      }
      if (settings.syncStock) {
        phases.push('stock');
      }
      if (settings.syncOrder) {
        phases.push('orders');
      }
      if (settings.syncPrice) {
        phases.push('prices');
      }
      if (phases.length === 0) {
        setSyncMessage('Senkron edilecek veri seçilmedi (Ayarlar).');
        return;
      }

      setSyncBusy(true);
      setSyncMessage(null);
      setSyncProgressStatus('running');
      setSyncTotal(phases.length);
      setSyncCurrent(0);
      const started = Date.now();
      let runningLogId: string | null = null;

      try {
        await tauriApi.setTrayIndicator('syncing');
        runningLogId = appendSyncLog({
          type: 'PRODUCT',
          status: 'RUNNING',
          itemCount: 0,
          duration: 0,
          erpType,
        }).id;

        let products: ErpSyncEngineResult = {
          productsSynced: 0,
          ordersPushed: 0,
          errors: [],
          durationMs: 0,
          syncedAt: new Date().toISOString(),
        };
        let orders: ErpSyncEngineResult = products;
        let step = 0;

        for (const phase of phases) {
          setSyncPhase(phase);
          setSyncCurrent(step);

          if (phase === 'products') {
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
            const counts: ErpResourceCounts = {
              products: products.productsSynced,
              orders: resourceCounts.orders,
              stock: resourceCounts.stock,
              updatedAt: new Date().toISOString(),
            };
            setResourceCounts(counts);
            saveErpResourceCounts(counts);
          } else if (phase === 'stock') {
            /* Stok fazı: ürün sync çıktısından türetilir (ayrı uç yok) */
            const counts: ErpResourceCounts = {
              products: products.productsSynced,
              orders: resourceCounts.orders,
              stock: products.productsSynced,
              updatedAt: new Date().toISOString(),
            };
            setResourceCounts(counts);
            saveErpResourceCounts(counts);
          } else if (phase === 'orders' && settings.syncOrder) {
            orders = await tauriApi.syncErpOrders({
              erpType,
              credentials,
              cloudApiUrl: apiUrl.trim(),
              apiKey: tok.token,
            });
            const counts: ErpResourceCounts = {
              products: products.productsSynced,
              orders: orders.ordersPushed,
              stock: products.productsSynced,
              updatedAt: new Date().toISOString(),
            };
            setResourceCounts(counts);
            saveErpResourceCounts(counts);
          }

          step += 1;
          setSyncCurrent(step);
        }

        const softFail = products.errors.length + orders.errors.length > 0;
        const summary = [
          summarizeEngine(sourceLabel, products, 'Ürün'),
          settings.syncOrder ? summarizeEngine(sourceLabel, orders, 'Sipariş') : null,
        ]
          .filter(Boolean)
          .join('\n');

        setSyncMessage(summary);
        setSyncProgressStatus(softFail ? 'error' : 'completed');
        if (!softFail && settings.notifyOnComplete) {
          showDesktopNotification('Senkronize', 'ERP senkronu tamamlandı.');
        }

        if (runningLogId) {
          updateSyncLog(runningLogId, {
            status: softFail ? 'PARTIAL' : 'SUCCESS',
            itemCount: products.productsSynced + orders.ordersPushed,
            duration: Date.now() - started,
            error: softFail ? products.errors.concat(orders.errors).join(' · ') : undefined,
            erpType,
          });
        }

        appendSyncLog({
          type: 'PRODUCT',
          status: softFail ? 'PARTIAL' : 'SUCCESS',
          itemCount: products.productsSynced,
          duration: Date.now() - started,
          erpType,
          error: softFail ? products.errors.join(' · ') : undefined,
        });
        if (settings.syncOrder) {
          appendSyncLog({
            type: 'ORDER',
            status: orders.errors.length ? 'PARTIAL' : 'SUCCESS',
            itemCount: orders.ordersPushed,
            duration: orders.durationMs,
            erpType,
            error: orders.errors.length ? orders.errors.join(' · ') : undefined,
          });
        }

        await tauriApi.recordLastSync(orders.syncedAt);
        await refreshSyncStatus();
        await tauriApi.setTrayIndicator(softFail ? 'error' : 'idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSyncMessage(message);
        setSyncProgressStatus('error');
        if (runningLogId) {
          updateSyncLog(runningLogId, {
            status: 'FAILED',
            duration: Date.now() - started,
            error: message,
            erpType,
          });
        }
        appendSyncLog({
          type: 'PRODUCT',
          status: 'FAILED',
          itemCount: 0,
          duration: Date.now() - started,
          erpType,
          error: message,
          affectedRecords: ['Senkron başlatılamadı'],
        });
        if (settings.notifyOnError) {
          showDesktopNotification('Senkronize', `ERP senkron hatası: ${message}`);
        }
        await tauriApi.setTrayIndicator('error');
      } finally {
        setSyncBusy(false);
        window.setTimeout(() => {
          setSyncProgressStatus((prev) => (prev === 'error' ? prev : 'idle'));
        }, 2200);
      }
    },
    [
      apiUrl,
      credentials,
      erpType,
      formValid,
      lastServerSync,
      refreshSyncStatus,
      resourceCounts.orders,
      resourceCounts.stock,
      summarizeEngine,
    ],
  );

  useEffect(() => {
    let unlistenAuto: (() => void) | undefined;
    let unlistenTray: (() => void) | undefined;
    void (async () => {
      unlistenAuto = await listen('auto-sync-tick', () => {
        if (!useAppStore.getState().token) {
          return;
        }
        void runFullErpSync('Zamanlayıcı');
      });
      unlistenTray = await listen('tray-sync-request', () => {
        if (!useAppStore.getState().token) {
          return;
        }
        void runFullErpSync('Tray');
      });
    })();
    return () => {
      unlistenAuto?.();
      unlistenTray?.();
    };
  }, [runFullErpSync]);

  async function onTestConnection(): Promise<void> {
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
      if (res.success && res.productCount !== null) {
        const counts: ErpResourceCounts = {
          products: res.productCount,
          orders: resourceCounts.orders,
          stock: resourceCounts.stock,
          updatedAt: new Date().toISOString(),
        };
        setResourceCounts(counts);
        saveErpResourceCounts(counts);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestOk(false);
      setTestMessage(message);
    } finally {
      setTestBusy(false);
    }
  }

  const cloudKeyPreview = useMemo(() => {
    if (!token?.token) {
      return null;
    }
    return maskToken(token.token);
  }, [token?.token]);

  function renderErpFields(): ReactElement {
    switch (erpType) {
      case 'BIZIMHESAP':
        return (
          <>
            <label className="fieldLabel" htmlFor="bhApiKey">
              API Key
            </label>
            <input
              id="bhApiKey"
              type="password"
              className="input"
              value={apiKey}
              onChange={(e) => updateForm({ apiKey: e.target.value })}
              autoComplete="off"
            />
          </>
        );
      case 'LOGO':
        return (
          <>
            <div className="grid2">
              <div>
                <label className="fieldLabel" htmlFor="logoIp">
                  Sunucu IP
                </label>
                <input
                  id="logoIp"
                  className="input"
                  value={serverIp}
                  onChange={(e) => updateForm({ serverIp: e.target.value })}
                  placeholder="192.168.1.10"
                />
              </div>
              <div>
                <label className="fieldLabel" htmlFor="logoPort">
                  Port
                </label>
                <input
                  id="logoPort"
                  className="input"
                  value={serverPort}
                  onChange={(e) => updateForm({ serverPort: e.target.value })}
                />
              </div>
            </div>
            <label className="fieldLabel" htmlFor="logoDb">
              Veritabanı adı
            </label>
            <input
              id="logoDb"
              className="input"
              value={dbName}
              onChange={(e) => updateForm({ dbName: e.target.value })}
              autoComplete="off"
            />
          </>
        );
      case 'PARASUT':
        return (
          <>
            <label className="fieldLabel" htmlFor="psToken">
              API Token
            </label>
            <input
              id="psToken"
              type="password"
              className="input"
              value={apiToken}
              onChange={(e) => updateForm({ apiToken: e.target.value })}
              autoComplete="off"
            />
          </>
        );
      case 'MIKRO':
        return (
          <>
            <label className="fieldLabel" htmlFor="mikroConn">
              Bağlantı dizesi
            </label>
            <input
              id="mikroConn"
              className="input"
              value={connectionString}
              onChange={(e) => updateForm({ connectionString: e.target.value })}
              placeholder="http://192.168.1.10:8080 veya tam connection string"
              autoComplete="off"
            />
          </>
        );
      default:
        return <p className="muted">Desteklenmeyen ERP tipi.</p>;
    }
  }

  const indicatorClass =
    connectionTone === 'ok'
      ? 'connectionIndicatorOk'
      : connectionTone === 'warn'
        ? 'connectionIndicatorWarn'
        : 'connectionIndicatorBad';

  const dotClass = connectionTone === 'ok' ? 'dotOk' : connectionTone === 'warn' ? 'dotWarn' : 'dotBad';

  return (
    <div className="stackLg">
      <div>
        <h1 className="h2">ERP Köprüsü</h1>
        <p className="muted">Yerel ERP ile bulut arasında ürün ve sipariş senkronu.</p>
      </div>

      <div className="panel">
        <p className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} aria-hidden />
          Bağlantı durumu
        </p>
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span className={`pill ${indicatorClass}`}>
            <span className={`dot ${dotClass}`} />
            {connectionLabel}
          </span>
          <span className="muted" style={{ fontSize: 13, margin: 0 }}>
            Bulut: {health?.cloudConnected ? 'çevrimiçi' : 'çevrimdışı'} · ERP:{' '}
            {testOk === null ? 'test edilmedi' : testOk ? 'doğrulandı' : 'hata'}
          </span>
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#334155' }}>
          <span>
            <span style={{ fontWeight: 650 }}>Son sync:</span>{' '}
            {lastServerSync ? formatTs(lastServerSync) : '—'}
          </span>
          <span>
            <span style={{ fontWeight: 650 }}>Sync sıklığı:</span> {intervalLabel(syncSettings.intervalMinutes)}
          </span>
        </div>

        {testBusy ? (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <span className="spinner" aria-hidden />
            <span className="muted" style={{ fontSize: 13 }}>
              Bağlantı test ediliyor…
            </span>
          </div>
        ) : null}
        {!testBusy && testMessage ? (
          <p className={testOk ? 'testResultOk' : 'testResultBad'} style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
            {testOk ? '✓' : '✗'} {testMessage}
            {testOk && testProductCount !== null ? ` · ${testProductCount} ürün` : ''}
            {testDurationMs !== null ? ` · ${testDurationMs} ms` : ''}
            {testVersion ? ` · ${testVersion}` : ''}
          </p>
        ) : null}
      </div>

      <div className="panel">
        <p className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} aria-hidden />
          Bağlı kaynaklar
        </p>
        <div className="resourceGrid">
          <div className="resourceCard">
            <Package size={16} aria-hidden style={{ color: '#0ea5e9' }} />
            <div className="resourceCardValue">{resourceCounts.products ?? '—'}</div>
            <div className="resourceCardLabel">Ürün</div>
          </div>
          <div className="resourceCard">
            <ShoppingCart size={16} aria-hidden style={{ color: '#0ea5e9' }} />
            <div className="resourceCardValue">{resourceCounts.orders ?? '—'}</div>
            <div className="resourceCardLabel">Sipariş</div>
          </div>
          <div className="resourceCard">
            <Warehouse size={16} aria-hidden style={{ color: '#0ea5e9' }} />
            <div className="resourceCardValue">{resourceCounts.stock ?? '—'}</div>
            <div className="resourceCardLabel">Stok</div>
          </div>
        </div>
        {resourceCounts.updatedAt ? (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
            Son güncelleme: {formatTs(resourceCounts.updatedAt)}
          </p>
        ) : null}
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
          onChange={(e) => updateForm({ erpType: e.target.value as ErpKind })}
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
            {testBusy ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
          </button>
        </div>
      </div>

      <div className="panel">
        <p className="h2">Senkronizasyon</p>
        {(syncBusy || syncProgressStatus !== 'idle') && (
          <div style={{ marginTop: 12 }}>
            <SyncProgress
              phase={syncPhase}
              current={syncCurrent}
              total={syncTotal}
              status={syncProgressStatus}
              message={syncMessage ?? undefined}
            />
          </div>
        )}
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
        {syncMessage && !syncBusy ? (
          <pre className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {syncMessage}
          </pre>
        ) : null}
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
      </div>
    </div>
  );
}
