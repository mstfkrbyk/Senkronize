import { CheckCircle2, Copy, XCircle } from 'lucide-react';
import { useCallback, useMemo, type ReactElement } from 'react';

import type { SyncResult } from '@/lib/tauri';

interface SyncLogItemProps {
  log: SyncResult;
  platformLabel: string;
}

function resolveLevel(log: SyncResult): 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN' {
  if (log.level) {
    return log.level;
  }
  return log.success ? 'SUCCESS' : 'ERROR';
}

function formatTime(syncedAt: string): string {
  const d = new Date(syncedAt);
  if (Number.isNaN(d.getTime())) {
    return '--:--:--';
  }
  return d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function levelTextClass(level: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN'): string {
  if (level === 'INFO') {
    return 'logLevelTextInfo';
  }
  if (level === 'ERROR') {
    return 'logLevelTextError';
  }
  if (level === 'WARN') {
    return 'logLevelTextWarn';
  }
  return 'logLevelTextSuccess';
}

export function SyncLogItem({ log, platformLabel }: SyncLogItemProps): ReactElement {
  const level = resolveLevel(log);
  const timeStr = useMemo(() => formatTime(log.syncedAt), [log.syncedAt]);

  const lineForCopy = useMemo(() => {
    return `[${timeStr}] [${level}] ${platformLabel}: ${log.message}`;
  }, [level, log.message, platformLabel, timeStr]);

  const Icon =
    level === 'ERROR'
      ? XCircle
      : level === 'WARN'
        ? XCircle
        : level === 'INFO'
          ? CheckCircle2
          : CheckCircle2;

  const iconClass =
    level === 'ERROR'
      ? 'iconBad'
      : level === 'WARN'
        ? 'iconWarn'
        : level === 'INFO'
          ? 'iconInfo'
          : log.success
            ? 'iconOk'
            : 'iconBad';

  const badgeClass =
    level === 'INFO'
      ? 'logBadge logBadgeInfo'
      : level === 'ERROR'
        ? 'logBadge logBadgeError'
        : level === 'WARN'
          ? 'logBadge logBadgeWarn'
          : 'logBadge logBadgeSuccess';

  const onCopyClick = useCallback(() => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(lineForCopy);
      } catch (err) {
        console.error('Panoya kopyalama başarısız', err);
      }
    })();
  }, [lineForCopy]);

  return (
    <div className="logItem">
      <Icon className={iconClass} size={18} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="logTitle" style={{ alignItems: 'center' }}>
          <span className="logMeta logTimeMono" title={log.syncedAt}>
            [{timeStr}]
          </span>
          <span className={badgeClass}>{level}</span>
          <span className={levelTextClass(level)} style={{ fontWeight: 650 }}>
            {platformLabel}
          </span>
          <button
            type="button"
            className="logCopyBtn"
            onClick={onCopyClick}
            title="Satırı kopyala"
            aria-label="Log satırını panoya kopyala"
          >
            <Copy size={14} aria-hidden />
          </button>
        </div>
        <div
          className="logBody logBodyTrunc"
          title={log.message}
        >
          {log.message}
        </div>
      </div>
    </div>
  );
}
