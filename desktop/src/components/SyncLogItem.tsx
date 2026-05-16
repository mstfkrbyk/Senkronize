import { CheckCircle2, XCircle } from 'lucide-react';

import type { SyncResult } from '@/lib/tauri';

interface SyncLogItemProps {
  log: SyncResult;
  platformLabel: string;
}

export function SyncLogItem({ log, platformLabel }: SyncLogItemProps): React.ReactElement {
  const Icon = log.success ? CheckCircle2 : XCircle;
  const iconClass = log.success ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
          <span>{platformLabel}</span>
          <span className="text-xs font-normal text-slate-500">{log.syncedAt}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{log.message}</p>
      </div>
    </div>
  );
}
