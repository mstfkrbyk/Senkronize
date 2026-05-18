import { useMemo, useState, type ReactElement } from 'react';

import { SyncLogItem } from '@/components/SyncLogItem';
import type { SyncResult } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

function logKey(log: { syncedAt: string; message: string }, idx: number): string {
  return `${log.syncedAt}::${idx}::${log.message}`;
}

type LevelFilter = 'ALL' | 'ERROR' | 'SUCCESS' | 'WARN';

function resolveLevel(log: SyncResult): 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN' {
  if (log.level) {
    return log.level;
  }
  return log.success ? 'SUCCESS' : 'ERROR';
}

function matchesFilter(level: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN', filter: LevelFilter): boolean {
  if (filter === 'ALL') {
    return true;
  }
  return level === filter;
}

export function LogsPage(): ReactElement {
  const syncLogs = useAppStore((s) => s.syncLogs);
  const clearSyncLogs = useAppStore((s) => s.clearSyncLogs);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>('ALL');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return syncLogs.filter((log) => {
      const level = resolveLevel(log);
      if (!matchesFilter(level, levelFilter)) {
        return false;
      }
      if (q.length === 0) {
        return true;
      }
      return log.message.toLowerCase().includes(q) || log.syncedAt.toLowerCase().includes(q);
    });
  }, [syncLogs, levelFilter, search]);

  const visible = showAll ? filtered : filtered.slice(0, 100);
  const hasMore = !showAll && filtered.length > 100;

  return (
    <div className="stackLg">
      <div className="flexBetween">
        <div>
          <h1 className="h2">Senkron Logları</h1>
          <p className="muted">
            Son 100 kayıt saklanır. {filtered.length} kayıt gösteriliyor
            {hasMore ? ' (ilk 100)' : ''}.
          </p>
        </div>
        <button type="button" onClick={() => clearSyncLogs()} className="btn btnGhost">
          Logları Temizle
        </button>
      </div>

      <div className="panel" style={{ padding: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label className="muted" style={{ fontSize: 13 }}>
            Seviye
            <select
              className="input"
              style={{ marginLeft: 8, minWidth: 120 }}
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            >
              <option value="ALL">Tümü</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
            </select>
          </label>
          <label className="muted" style={{ fontSize: 13, flex: '1 1 200px' }}>
            Ara
            <input
              className="input"
              type="search"
              placeholder="Mesaj veya tarih..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginLeft: 8, width: '100%', minWidth: 0 }}
            />
          </label>
        </div>
      </div>

      {hasMore ? (
        <button type="button" className="btn btnGhost" onClick={() => setShowAll(true)}>
          Tümünü Göster ({filtered.length} kayıt)
        </button>
      ) : null}

      {showAll && filtered.length > 100 ? (
        <button type="button" className="btn btnGhost" onClick={() => setShowAll(false)}>
          İlk 100 kayda dön
        </button>
      ) : null}

      <div className="stack">
        {visible.map((log, idx) => (
          <SyncLogItem key={logKey(log, idx)} log={log} platformLabel="Senkron" />
        ))}
        {visible.length === 0 ? <p className="muted" style={{ margin: 0 }}>Kayıt yok.</p> : null}
      </div>
    </div>
  );
}
