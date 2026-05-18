import { listen } from '@tauri-apps/api/event';
import { Activity, Link2, ScrollText, Settings } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { tauriApi } from '@/lib/tauri';
import { ErpBridgePage } from '@/pages/ErpBridgePage';
import { LogsPage } from '@/pages/LogsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SetupPage } from '@/pages/SetupPage';
import { StatusPage } from '@/pages/StatusPage';
import { useAppStore } from '@/store/app.store';

type Page = 'status' | 'settings' | 'logs' | 'erpBridge';

export default function App(): ReactElement {
  const token = useAppStore((s) => s.token);
  const setToken = useAppStore((s) => s.setToken);

  const [page, setPage] = useState<Page>('status');
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await tauriApi.loadToken();
        if (loaded) {
          setToken(loaded);
        }
      } finally {
        setBootReady(true);
      }
    })();
  }, [setToken]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void (async () => {
      unlisten = await listen('tray-sync-request', async () => {
        const state = useAppStore.getState();
        if (!state.token) return;

        const platforms = [
          { id: 'TRENDYOL', label: 'Trendyol' },
          { id: 'HEPSIBURADA', label: 'Hepsiburada' },
        ] as const;

        for (const p of platforms) {
          try {
            const res = await tauriApi.triggerSync(state.apiUrl, state.token.token, p.id);
            state.addSyncLog({ ...res, message: `${p.label}: ${res.message}` });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            state.addSyncLog({
              success: false,
              message: `${p.label}: ${message}`,
              syncedAt: new Date().toISOString(),
            });
          }
        }
      });
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  function onResetSession(): void {
    setToken(null);
    setPage('status');
  }

  if (!bootReady) {
    return (
      <div className="center">
        <p className="muted" style={{ margin: 0 }}>
          Yükleniyor…
        </p>
      </div>
    );
  }

  if (!token) {
    return <SetupPage />;
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarBrand">
          <div className="sidebarTitle">Senkronize</div>
          <div className="sidebarSubtitle">Desktop Köprüsü</div>
        </div>

        <nav className="nav">
          <button
            type="button"
            className={`navBtn ${page === 'status' ? 'navBtnActive' : ''}`}
            onClick={() => setPage('status')}
          >
            <Activity size={16} />
            Durum
          </button>
          <button
            type="button"
            className={`navBtn ${page === 'settings' ? 'navBtnActive' : ''}`}
            onClick={() => setPage('settings')}
          >
            <Settings size={16} />
            Ayarlar
          </button>
          <button
            type="button"
            className={`navBtn ${page === 'erpBridge' ? 'navBtnActive' : ''}`}
            onClick={() => setPage('erpBridge')}
          >
            <Link2 size={16} />
            ERP Bridge
          </button>
          <button
            type="button"
            className={`navBtn ${page === 'logs' ? 'navBtnActive' : ''}`}
            onClick={() => setPage('logs')}
          >
            <ScrollText size={16} />
            Loglar
          </button>
        </nav>
      </aside>

      <main className="main">
        {page === 'status' ? <StatusPage /> : null}
        {page === 'settings' ? <SettingsPage onResetSession={onResetSession} /> : null}
        {page === 'erpBridge' ? <ErpBridgePage /> : null}
        {page === 'logs' ? <LogsPage /> : null}
      </main>
    </div>
  );
}
