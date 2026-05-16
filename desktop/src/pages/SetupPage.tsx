import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { open } from '@tauri-apps/plugin-shell';

import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

const PANEL_TOKEN_HINT = 'https://panel.senkronize.com';

export function SetupPage(): ReactElement {
  const setToken = useAppStore((s) => s.setToken);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const setHealth = useAppStore((s) => s.setHealth);

  const persistedApiUrl = useAppStore((s) => s.apiUrl);

  const [apiUrl, setApiUrlField] = useState(persistedApiUrl);
  const [token, setTokenField] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => apiUrl.trim().length > 0 && token.trim().length > 0, [apiUrl, token]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError('API adresi ve token zorunludur.');
      return;
    }

    setLoading(true);
    try {
      const health = await tauriApi.checkHealth(apiUrl.trim(), token.trim(), null);
      if (!health.cloudConnected) {
        setError('Bulut API sağlık kontrolü başarısız. Adresi ve tokenı doğrulayın.');
        return;
      }

      const payload = {
        token: token.trim(),
        orgName: orgName.trim() || '—',
        orgId: orgId.trim() || '—',
      };

      await tauriApi.saveToken(payload);
      await tauriApi.loadToken(); // doğrula
      setApiUrl(apiUrl.trim());
      setHealth(health);
      setToken(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Senkronize Desktop Kurulumu</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu uygulama yerel ERP/muhasebe yazılımınız ile Senkronize bulut API arasında köprü kurar.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="apiUrl">
              API URL
            </label>
            <input
              id="apiUrl"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
              value={apiUrl}
              onChange={(ev) => setApiUrlField(ev.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="token">
              API Token
            </label>
            <input
              id="token"
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
              value={token}
              onChange={(ev) => setTokenField(ev.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="mt-2 text-sm font-medium text-sky-600 hover:underline"
              onClick={() => void open(PANEL_TOKEN_HINT)}
            >
              Senkronize panelinden API token oluşturun
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="orgName">
                Organizasyon adı (opsiyonel)
              </label>
              <input
                id="orgName"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
                value={orgName}
                onChange={(ev) => setOrgName(ev.target.value)}
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="orgId">
                Organizasyon ID (opsiyonel)
              </label>
              <input
                id="orgId"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400 focus:ring-2"
                value={orgId}
                onChange={(ev) => setOrgId(ev.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Bağlanıyor…' : 'Bağlan'}
          </button>
        </form>
      </div>
    </div>
  );
}
