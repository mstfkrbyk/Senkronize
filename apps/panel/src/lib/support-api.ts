import { api } from '@/lib/api';
import type {
  AdminSupportTicketListItem,
  SupportSlaReport,
  SupportStats,
  SupportTicketDetail,
  SupportTicketListItem,
  TicketPriority,
  TicketStatus,
} from '@/types/support';

export async function fetchSupportTickets(params?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SupportTicketListItem[]> {
  const { data } = await api.get<{ data: SupportTicketListItem[] }>(
    '/support/tickets',
    { params },
  );
  return data.data;
}

export async function fetchSupportTicket(id: string): Promise<SupportTicketDetail> {
  const { data } = await api.get<{ data: SupportTicketDetail }>(
    `/support/tickets/${id}`,
  );
  return data.data;
}

export async function createSupportTicket(payload: {
  subject: string;
  content: string;
  category?: string;
  priority: TicketPriority;
}): Promise<SupportTicketDetail> {
  const { data } = await api.post<{ data: SupportTicketDetail }>(
    '/support/tickets',
    payload,
  );
  return data.data;
}

export async function addSupportTicketMessage(
  ticketId: string,
  content: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.post<{ data: SupportTicketDetail }>(
    `/support/tickets/${ticketId}/messages`,
    { content },
  );
  return data.data;
}

export async function closeSupportTicket(
  ticketId: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.patch<{ data: SupportTicketDetail }>(
    `/support/tickets/${ticketId}/close`,
  );
  return data.data;
}

export async function fetchAdminTickets(params?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  organizationId?: string;
  assignedTo?: string;
}): Promise<AdminSupportTicketListItem[]> {
  const { data } = await api.get<{ data: AdminSupportTicketListItem[] }>(
    '/admin/support/tickets',
    { params },
  );
  return data.data;
}

export async function fetchAdminTicket(id: string): Promise<SupportTicketDetail> {
  const { data } = await api.get<{ data: SupportTicketDetail }>(
    `/admin/support/tickets/${id}`,
  );
  return data.data;
}

export async function fetchAdminSupportStats(): Promise<SupportStats> {
  const { data } = await api.get<{ data: SupportStats }>('/admin/support/stats');
  return data.data;
}

export async function fetchAdminSupportSla(): Promise<SupportSlaReport> {
  const { data } = await api.get<{ data: SupportSlaReport }>('/admin/support/sla');
  return data.data;
}

export async function updateAdminTicket(
  id: string,
  payload: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedTo?: string | null;
  },
): Promise<SupportTicketDetail> {
  const { data } = await api.patch<{ data: SupportTicketDetail }>(
    `/admin/support/tickets/${id}`,
    payload,
  );
  return data.data;
}

export async function assignAdminTicket(
  id: string,
  adminId: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.post<{ data: SupportTicketDetail }>(
    `/admin/support/tickets/${id}/assign`,
    { adminId },
  );
  return data.data;
}

export async function addAdminTicketMessage(
  id: string,
  content: string,
  isInternal: boolean,
): Promise<SupportTicketDetail> {
  const { data } = await api.post<{ data: SupportTicketDetail }>(
    `/admin/support/tickets/${id}/messages`,
    { content, isInternal },
  );
  return data.data;
}

export async function addAdminInternalNote(
  id: string,
  content: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.post<{ data: SupportTicketDetail }>(
    `/admin/support/tickets/${id}/internal-note`,
    { content },
  );
  return data.data;
}
