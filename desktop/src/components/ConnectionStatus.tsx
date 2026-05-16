import type { HealthStatus } from '@/lib/tauri';

interface ConnectionStatusProps {
  health: HealthStatus | null;
}

export function ConnectionStatus({ health }: ConnectionStatusProps): React.ReactElement {
  const cloudOk = health?.cloudConnected === true;
  const localOk = health?.localErpConnected === true;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Bağlantı Özeti</p>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${cloudOk ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <span>Bulut API: {cloudOk ? 'Ulaşılabilir' : 'Ulaşılamıyor'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${localOk ? 'bg-emerald-500' : 'bg-slate-300'}`}
          />
          <span>Yerel ERP: {localOk ? 'Ulaşılabilir' : 'Test edilmedi / kapalı'}</span>
        </div>
      </div>
    </div>
  );
}
