import { useMemo, type ReactElement } from 'react';

import { SyncLogItem } from '@/components/SyncLogItem';
import { useAppStore } from '@/store/app.store';

function logKey(log: { syncedAt: string; message: string }, idx: number): string {
  return `${log.syncedAt}::${idx}::${log.message}`;
}

export function LogsPage(): ReactElement {
  const syncLogs = useAppStore((s) => s.syncLogs);
  const clearSyncLogs = useAppStore((s) => s.clearSyncLogs);

  const items = useMemo(() => syncLogs, [syncLogs]);

  return (
    <div className="stackLg">
      <div className="flexBetween">
        <div>
          <h1 className="h2">Senkron Logları</h1>
          <p className="muted">Son 100 kayıt saklanır.</p>
        </div>
        <button type="button" onClick={() => clearSyncLogs()} className="btn btnGhost">
          Logları Temizle
        </button>
      </div>

      <div className="stack">
        {items.map((log, idx) => (
          <SyncLogItem key={logKey(log, idx)} log={log} platformLabel="Senkron" />
        ))}
        {items.length === 0 ? <p className="muted" style={{ margin: 0 }}>Henüz log yok.</p> : null}
      </div>
    </div>
  );
}
