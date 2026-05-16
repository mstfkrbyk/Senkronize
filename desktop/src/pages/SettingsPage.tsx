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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Ayarlar</h1>
        <p className="mt-1 text-sm text-slate-600">Bağlantı ve yerel çalışma tercihleri.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-slate-900" htmlFor="settingsApiUrl">
          API URL
        </label>
        <input
          id="settingsApiUrl"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-slate-900" htmlFor="localErpUrl">
          Yerel ERP tabanı (HTTP)
        </label>
        <input
          id="localErpUrl"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
          value={localErpBaseUrl}
          onChange={(e) => setLocalErpBaseUrl(e.target.value)}
          placeholder="http://192.168.1.10:8080"
          autoComplete="off"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || localErpBaseUrl.trim().length === 0}
            onClick={() => void onTestErp()}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Bağlantıyı Test Et
          </button>
          {erpTestMessage ? <p className="text-sm text-slate-700">{erpTestMessage}</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Başlangıçta otomatik başlat</p>
            <p className="mt-1 text-sm text-slate-600">
              Şimdilik yalnızca arayüzde tutulur (işletim sistemi entegrasyonu sonraya bırakıldı).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={launchOnStartup}
            onClick={() => setLaunchOnStartup((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition ${
              launchOnStartup ? 'bg-sky-400' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                launchOnStartup ? 'left-5' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Sync aralığı</p>
        <p className="mt-1 text-sm text-slate-600">
          Şimdilik yalnızca planlama arayüzü; zamanlayıcı entegrasyonu sonraki adım.
        </p>
        <select
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
          value={syncInterval}
          onChange={(e) => setSyncInterval(e.target.value as SyncInterval)}
        >
          <option value="manual">El ile</option>
          <option value="15m">15 dakika</option>
          <option value="30m">30 dakika</option>
          <option value="1h">1 saat</option>
        </select>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-900">Oturumu sıfırla</p>
        <p className="mt-1 text-sm text-red-800">
          Anahtar zincirindeki token silinir ve kurulum ekranına dönersiniz.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onResetToken()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Tokenı Sıfırla
        </button>
      </div>
    </div>
  );
}
