import type { ReactElement } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

import type { LoginHistoryEntry } from './login-history.util';

export function LoginHistoryDeviceIcon({
  deviceType,
}: {
  deviceType?: LoginHistoryEntry['deviceType'];
}): ReactElement {
  const className = 'mr-2 inline size-4 shrink-0 text-muted-foreground';
  if (deviceType === 'mobile') {
    return <Smartphone className={className} aria-hidden />;
  }
  if (deviceType === 'tablet') {
    return <Tablet className={className} aria-hidden />;
  }
  return <Monitor className={className} aria-hidden />;
}
