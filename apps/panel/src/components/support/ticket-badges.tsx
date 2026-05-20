import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import type { TicketPriority, TicketStatus } from '@/types/support';

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  WAITING_CUSTOMER: 'Müşteri Bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapalı',
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_CUSTOMER: 'bg-violet-100 text-violet-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-700',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
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
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}): ReactElement {
  return (
    <Badge variant="secondary" className={PRIORITY_CLASS[priority]}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export const TICKET_CATEGORY_OPTIONS = [
  { value: 'entegrasyon', label: 'Entegrasyon' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'teknik', label: 'Teknik' },
  { value: 'genel', label: 'Genel' },
] as const;
