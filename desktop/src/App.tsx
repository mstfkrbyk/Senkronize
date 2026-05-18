import { listen } from '@tauri-apps/api/event';
import { Activity, Link2, ScrollText, Settings } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { runFullPlatformSync } from '@/lib/run-platform-sync';
import { tauriApi, type UpdateCheckResponse } from '@/lib/tauri';
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
  const pendingSidebarNav = useAppStore((s) => s.pendingSidebarNav);
  const setPendingSidebarNav = useAppStore((s) => s.setPendingSidebarNav);

  const [page, setPage] = useState<Page>('status');
  const [bootReady, setBootReady] = useState(false);
  const [updateToast, setUpdateToast] = useState<UpdateCheckResponse | null>(null);

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
    if (pendingSidebarNav === 'settings') {
      setPage('settings');
      setPendingSidebarNav(null);
    }
  }, [pendingSidebarNav, setPendingSidebarNav]);

  useEffect(() => {
    if (!bootReady) {
      return;
    }

    void (async () => {
      try {
        const res = await tauriApi.checkForUpdates();
        if (res.hasUpdate) {
          setUpdateToast(res);
        }
      } catch (err) {
        void err;
        /* Sürüm servisi yoksa veya ağ hatası: sessiz geç */
      }
    })();
  }, [bootReady]);

  useEffect(() => {
    let unlistenTray: (() => void) | undefined;
    let unlistenAuto: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;

    void (async () => {
      unlistenTray = await listen('tray-sync-request', () => {
        void runFullPlatformSync();
      });
      unlistenAuto = await listen('auto-sync-tick', () => {
        void runFullPlatformSync();
      });
      unlistenSettings = await listen('open-settings', () => {
        useAppStore.getState().setPendingSidebarNav('settings');
      });
    })();

    return () => {
      unlistenTray?.();
      unlistenAuto?.();
      unlistenSettings?.();
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
      {updateToast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 50,
            maxWidth: 360,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#0f172a',
            color: '#f8fafc',
            boxShadow: '0 10px 30px rgba(15,23,42,0.25)',
            fontSize: 13,
          }}
        >
          <p style={{ margin: 0, fontWeight: 650 }}>Yeni sürüm mevcut</p>
          <p style={{ margin: '8px 0 0', opacity: 0.92 }}>
            {updateToast.currentVersion} → {updateToast.latestVersion}
          </p>
          {updateToast.releaseNotes ? (
            <p style={{ margin: '8px 0 0', opacity: 0.85, whiteSpace: 'pre-wrap' }}>
              {updateToast.releaseNotes}
            </p>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {updateToast.downloadUrl ? (
              <button
                type="button"
                className="btn btnAccent"
                style={{ fontSize: 12, padding: '6px 10px' }}
                onClick={() =>
                  void (async () => {
                    try {
                      const { open } = await import('@tauri-apps/plugin-shell');
                      await open(updateToast.downloadUrl ?? '');
                    } catch {
                      window.open(updateToast.downloadUrl ?? '', '_blank', 'noopener,noreferrer');
                    }
                  })()
                }
              >
                İndirme bağlantısı
              </button>
            ) : null}
            <button
              type="button"
              className="btn btnGhost"
              style={{ fontSize: 12, padding: '6px 10px', color: '#e2e8f0', borderColor: '#334155' }}
              onClick={() => setUpdateToast(null)}
            >
              Kapat
            </button>
          </div>
        </div>
      ) : null}

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
