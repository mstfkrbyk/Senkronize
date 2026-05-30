import type { ReactElement } from 'react';

import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import { formatInvoiceDate } from './invoice-utils';
import {
  OVERDUE_ALERT_CLASS,
  OVERDUE_ALERT_DESC_CLASS,
  OVERDUE_ALERT_LINK_CLASS,
  OVERDUE_ALERT_TITLE_CLASS,
  OVERDUE_FILTER_HREF,
} from './overdue-alert.shared';
import { invoicesT } from './translations';

interface Props {
  dueDate: string | null;
  className?: string;
  /** Listeye git bağlantısı */
  hideCta?: boolean;
}

export function InvoiceOverdueWarning({
  dueDate,
  className,
  hideCta = false,
}: Props): ReactElement {
  const description = dueDate
    ? invoicesT('overdue.warningWithDue', { dueDate: formatInvoiceDate(dueDate) })
    : invoicesT('overdue.warningNoDue');

  return (
    <Alert className={cn(OVERDUE_ALERT_CLASS, className)} role="status">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
      <AlertTitle className={OVERDUE_ALERT_TITLE_CLASS}>
        {invoicesT('overdue.warningTitle')}
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
      </AlertDescription>
    </Alert>
  );
}
