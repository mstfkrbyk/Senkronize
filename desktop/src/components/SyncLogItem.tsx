import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';

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

export function SyncLogItem({ log, platformLabel }: SyncLogItemProps): ReactElement {
  const level = resolveLevel(log);
  const Icon = log.success ? CheckCircle2 : XCircle;
  const iconClass = log.success ? 'iconOk' : 'iconBad';

  const badgeClass =
    level === 'INFO'
      ? 'logBadge logBadgeInfo'
      : level === 'ERROR'
        ? 'logBadge logBadgeError'
        : level === 'WARN'
          ? 'logBadge logBadgeWarn'
          : 'logBadge logBadgeSuccess';

  const badgeLabel =
    level === 'INFO'
      ? 'INFO'
      : level === 'ERROR'
        ? 'ERROR'
        : level === 'WARN'
          ? 'WARN'
          : 'SUCCESS';

  return (
    <div className="logItem">
      <Icon className={iconClass} size={18} aria-hidden style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="logTitle">
          <span className={badgeClass}>{badgeLabel}</span>
          <span>{platformLabel}</span>
          <span className="logMeta">{log.syncedAt}</span>
        </div>
        <div className="logBody">{log.message}</div>
      </div>
    </div>
  );
}
