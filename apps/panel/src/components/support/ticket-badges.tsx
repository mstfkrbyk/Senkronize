import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { TicketPriority, TicketStatus } from '@/types/support';

const STATUS_I18N_KEY: Record<TicketStatus, string> = {
  OPEN: 'support.status.open',
  IN_PROGRESS: 'support.status.in_progress',
  WAITING_CUSTOMER: 'support.status.waiting_customer',
  RESOLVED: 'support.status.resolved',
  CLOSED: 'support.status.closed',
};

const PRIORITY_I18N_KEY: Record<TicketPriority, string> = {
  LOW: 'support.priority.low',
  MEDIUM: 'support.priority.medium',
  HIGH: 'support.priority.high',
  URGENT: 'support.priority.urgent',
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_CUSTOMER: 'bg-violet-100 text-violet-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-700',
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export function TicketStatusBadge({
  status,
}: {
  status: TicketStatus;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {t(STATUS_I18N_KEY[status])}
    </Badge>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={PRIORITY_CLASS[priority]}>
      {t(PRIORITY_I18N_KEY[priority])}
    </Badge>
  );
}

export const TICKET_CATEGORY_OPTIONS = [
  { value: 'entegrasyon', label: 'Entegrasyon' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'teknik', label: 'Teknik' },
  { value: 'genel', label: 'Genel' },
] as const;
