import { api } from '@/lib/api';
import type {
  AdminSupportTicketListItem,
  SupportTicketDetail,
  SupportTicketListItem,
  TicketPriority,
  TicketStatus,
} from '@/types/support';

export async function fetchSupportTickets(params?: {
  status?: TicketStatus;
  priority?: TicketPriority;
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
}): Promise<AdminSupportTicketListItem[]> {
  const { data } = await api.get<{ data: AdminSupportTicketListItem[] }>(
    '/admin/tickets',
    { params },
  );
  return data.data;
}

export async function fetchAdminTicket(id: string): Promise<SupportTicketDetail> {
  const { data } = await api.get<{ data: SupportTicketDetail }>(
    `/admin/tickets/${id}`,
  );
  return data.data;
}

export async function updateAdminTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<SupportTicketDetail> {
  const { data } = await api.patch<{ data: SupportTicketDetail }>(
    `/admin/tickets/${id}/status`,
    { status },
  );
  return data.data;
}

export async function assignAdminTicket(
  id: string,
  adminId: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.patch<{ data: SupportTicketDetail }>(
    `/admin/tickets/${id}/assign`,
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
    `/admin/tickets/${id}/messages`,
    { content, isInternal },
  );
  return data.data;
}
