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

const DEFAULT_SUPPORT_STATS: SupportStats = {
  open: 0,
  inProgress: 0,
  waitingCustomer: 0,
  resolved: 0,
  closed: 0,
  totalOpen: 0,
};

const DEFAULT_SLA_TARGETS: SupportSlaReport['slaTargets'] = {
  firstResponseHours: 24,
  urgentFirstResponseHours: 4,
  resolutionHours: 72,
  urgentResolutionHours: 24,
};

const DEFAULT_SUPPORT_SLA: SupportSlaReport = {
  totalTickets: 0,
  resolvedTickets: 0,
  avgFirstResponseHours: null,
  avgResolutionHours: null,
  firstResponseComplianceRate: 0,
  resolutionComplianceRate: 0,
  slaTargets: DEFAULT_SLA_TARGETS,
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Backend `{ data: T }` veya düz gövde / hatalı şekil için güvenli çıkarma */
function unwrapDataField(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

function normalizeSupportStats(raw: unknown): SupportStats {
  const payload = unwrapDataField(raw);
  if (!payload || typeof payload !== 'object') {
    return DEFAULT_SUPPORT_STATS;
  }
  const row = payload as Record<string, unknown>;
  const open = asNumber(row.open);
  const inProgress = asNumber(row.inProgress);
  const waitingCustomer = asNumber(row.waitingCustomer);
  const resolved = asNumber(row.resolved);
  const closed = asNumber(row.closed);
  const totalOpen =
    typeof row.totalOpen === 'number'
      ? asNumber(row.totalOpen)
      : open + inProgress + waitingCustomer;
  return {
    open,
    inProgress,
    waitingCustomer,
    resolved,
    closed,
    totalOpen,
  };
}

function normalizeSupportSla(raw: unknown): SupportSlaReport {
  const payload = unwrapDataField(raw);
  if (!payload || typeof payload !== 'object') {
    return DEFAULT_SUPPORT_SLA;
  }
  const row = payload as Record<string, unknown>;
  const targetsRaw =
    row.slaTargets && typeof row.slaTargets === 'object'
      ? (row.slaTargets as Record<string, unknown>)
      : {};
  return {
    totalTickets: asNumber(row.totalTickets),
    resolvedTickets: asNumber(row.resolvedTickets),
    avgFirstResponseHours: asNullableNumber(row.avgFirstResponseHours),
    avgResolutionHours: asNullableNumber(row.avgResolutionHours),
    firstResponseComplianceRate: asNumber(row.firstResponseComplianceRate),
    resolutionComplianceRate: asNumber(row.resolutionComplianceRate),
    slaTargets: {
      firstResponseHours: asNumber(
        targetsRaw.firstResponseHours,
        DEFAULT_SLA_TARGETS.firstResponseHours,
      ),
      urgentFirstResponseHours: asNumber(
        targetsRaw.urgentFirstResponseHours,
        DEFAULT_SLA_TARGETS.urgentFirstResponseHours,
      ),
      resolutionHours: asNumber(
        targetsRaw.resolutionHours,
        DEFAULT_SLA_TARGETS.resolutionHours,
      ),
      urgentResolutionHours: asNumber(
        targetsRaw.urgentResolutionHours,
        DEFAULT_SLA_TARGETS.urgentResolutionHours,
      ),
    },
  };
}

function normalizeAdminTicketList(raw: unknown): AdminSupportTicketListItem[] {
  const payload = unwrapDataField(raw);
  if (Array.isArray(payload)) {
    return payload as AdminSupportTicketListItem[];
  }
  return [];
}

function normalizeSupportTicketDetail(raw: unknown): SupportTicketDetail {
  const payload = unwrapDataField(raw);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Destek talebi detayı alınamadı');
  }
  const row = payload as SupportTicketDetail;
  return {
    ...row,
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

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
  const { data } = await api.get('/admin/support/tickets', { params });
  return normalizeAdminTicketList(data);
}

export async function fetchAdminTicket(id: string): Promise<SupportTicketDetail> {
  const { data } = await api.get(`/admin/support/tickets/${id}`);
  return normalizeSupportTicketDetail(data);
}

export async function fetchAdminSupportStats(): Promise<SupportStats> {
  const { data } = await api.get('/admin/support/stats');
  return normalizeSupportStats(data);
}

export async function fetchAdminSupportSla(): Promise<SupportSlaReport> {
  const { data } = await api.get('/admin/support/sla');
  return normalizeSupportSla(data);
}

export async function updateAdminTicket(
  id: string,
  payload: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedTo?: string | null;
  },
): Promise<SupportTicketDetail> {
  const { data } = await api.patch(`/admin/support/tickets/${id}`, payload);
  return normalizeSupportTicketDetail(data);
}

export async function assignAdminTicket(
  id: string,
  adminId: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.post(`/admin/support/tickets/${id}/assign`, { adminId });
  return normalizeSupportTicketDetail(data);
}

export async function addAdminTicketMessage(
  id: string,
  content: string,
  isInternal: boolean,
): Promise<SupportTicketDetail> {
  const { data } = await api.post(`/admin/support/tickets/${id}/messages`, {
    content,
    isInternal,
  });
  return normalizeSupportTicketDetail(data);
}

export async function addAdminInternalNote(
  id: string,
  content: string,
): Promise<SupportTicketDetail> {
  const { data } = await api.post(`/admin/support/tickets/${id}/internal-note`, {
    content,
  });
  return normalizeSupportTicketDetail(data);
}
