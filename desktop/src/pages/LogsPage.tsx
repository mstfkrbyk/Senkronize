import { useMemo, type ReactElement } from 'react';

import { SyncLogItem } from '@/components/SyncLogItem';
import { useAppStore } from '@/store/app.store';

export function LogsPage(): ReactElement {
  const syncLogs = useAppStore((s) => s.syncLogs);
  const clearSyncLogs = useAppStore((s) => s.clearSyncLogs);

  const items = useMemo(() => syncLogs, [syncLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Senkron Logları</h1>
          <p className="mt-1 text-sm text-slate-600">Son 100 kayıt saklanır.</p>
        </div>
        <button
          type="button"
          onClick={() => clearSyncLogs()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Logları Temizle
        </button>
      </div>

      <div className="space-y-2">
        {items.map((log, idx) => (
          <SyncLogItem
            // eslint-disable-next-line react/no-array-index-key -- log list has no stable id
            key={`${log.syncedAt}-${idx}`}
            log={log}
            platformLabel="Senkron"
          />
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">Henüz log yok.</p>
        ) : null}
      </div>
    </div>
  );
}
