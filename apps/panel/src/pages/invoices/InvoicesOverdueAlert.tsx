import type { ReactElement } from 'react';

import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import {
  OVERDUE_ALERT_CLASS,
  OVERDUE_ALERT_DESC_CLASS,
  OVERDUE_ALERT_HINT_CLASS,
  OVERDUE_ALERT_LINK_CLASS,
  OVERDUE_ALERT_TITLE_CLASS,
  OVERDUE_FILTER_HREF,
} from './overdue-alert.shared';
import { invoicesT } from './translations';

interface Props {
  count: number;
  className?: string;
  /** Zaten vadesi geçmiş filtresindeyken CTA gizlenir */
  hideCta?: boolean;
  /** Günlük cron notu (liste / özet banner) */
  showCronHint?: boolean;
}

export function InvoicesOverdueAlert({
  count,
  className,
  hideCta = false,
  showCronHint = true,
}: Props): ReactElement | null {
  if (count <= 0) {
    return null;
  }

  const description =
    count === 1
      ? invoicesT('overdue.listDescriptionOne')
      : invoicesT('overdue.listDescription', { count: String(count) });

  return (
    <Alert className={cn(OVERDUE_ALERT_CLASS, className)} role="status">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
      <AlertTitle className={OVERDUE_ALERT_TITLE_CLASS}>
        {invoicesT('overdue.listTitle')}
      </AlertTitle>
      <AlertDescription className={OVERDUE_ALERT_DESC_CLASS}>
        <p>{description}</p>
        {hideCta ? null : (
          <p className="mt-2">
            <Link to={OVERDUE_FILTER_HREF} className={OVERDUE_ALERT_LINK_CLASS}>
              {invoicesT('overdue.viewOverdue')}
            </Link>
          </p>
        )}
        {showCronHint ? (
          <p className={OVERDUE_ALERT_HINT_CLASS}>{invoicesT('overdue.cronHint')}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
