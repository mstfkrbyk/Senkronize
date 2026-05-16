import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';

import type { SyncResult } from '@/lib/tauri';

interface SyncLogItemProps {
  log: SyncResult;
  platformLabel: string;
}

export function SyncLogItem({ log, platformLabel }: SyncLogItemProps): ReactElement {
  const Icon = log.success ? CheckCircle2 : XCircle;
  const iconClass = log.success ? 'iconOk' : 'iconBad';

  return (
    <div className="logItem">
      <Icon className={iconClass} size={18} aria-hidden style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="logTitle">
          <span>{platformLabel}</span>
          <span className="logMeta">{log.syncedAt}</span>
        </div>
        <div className="logBody">{log.message}</div>
      </div>
    </div>
  );
}
