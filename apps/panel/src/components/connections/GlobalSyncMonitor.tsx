import type { ReactElement } from 'react';

import {
  SyncMonitorPanel,
  useSyncMonitorEffects,
} from '@/components/connections/SyncMonitorPanel';

/** Layout genelinde sync dinleyicisi + kompakt panel. */
export function GlobalSyncMonitor(): ReactElement {
  useSyncMonitorEffects();
  return <SyncMonitorPanel compact />;
}
