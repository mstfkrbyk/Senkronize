import type { ReactElement } from 'react';

import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface Props {
  /** Mobilde tetikleyici için ek sınıflar */
  className?: string;
}

/** @deprecated NotificationCenter kullanın — geriye dönük uyumluluk */
export function NotificationBell({ className }: Props): ReactElement {
  return <NotificationCenter className={className} />;
}
